'use strict';

const amqplib = require('amqplib');
const db      = require('./db');
const config  = require('./config');

const EXCHANGE     = 'photo_events';
const PUBLISH_KEY  = 'photo.uploaded';
const CONSUME_KEY  = 'image.processed';
const CONSUME_QUEUE = 'image_processed_queue';

let channel = null; // shared channel used for publishing

/**
 * Connect to RabbitMQ with a retry loop.
 * RabbitMQ takes ~10s to fully start; without retries the service crashes on boot.
 */
async function connectWithRetry(url, maxAttempts = 15) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const conn = await amqplib.connect(url);
      conn.on('error', (err) => console.error('RabbitMQ connection error:', err.message));
      conn.on('close', ()  => console.warn('RabbitMQ connection closed — service will not publish'));
      return conn;
    } catch (err) {
      console.log(`RabbitMQ not ready (attempt ${attempt}/${maxAttempts}): ${err.message} — retrying in 3s`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not connect to RabbitMQ after maximum attempts');
}

/**
 * Set up the exchange, queues, and start consuming processed-image events.
 * Called once on service startup.
 */
async function setup() {
  const conn = await connectWithRetry(config.rabbitmqUrl);

  // Use a separate channel for consuming (best practice)
  const consumerChannel = await conn.createChannel();
  channel               = await conn.createChannel();

  // Declare the exchange once — all services declare it idempotently
  await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
  await consumerChannel.assertExchange(EXCHANGE, 'direct', { durable: true });

  // Queue for receiving "image processed" notifications from the Python service
  await consumerChannel.assertQueue(CONSUME_QUEUE, { durable: true });
  await consumerChannel.bindQueue(CONSUME_QUEUE, EXCHANGE, CONSUME_KEY);

  // Process one message at a time (prefetch=1 — fair dispatch)
  consumerChannel.prefetch(1);

  consumerChannel.consume(CONSUME_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const { photoId, thumbnailPath, mediumPath } = payload;

      console.log(`[RabbitMQ] image.processed received for photo ${photoId}`);

      // Update the database row with the processed image paths
      await db.query(
        `UPDATE photos
         SET thumbnail_path = $1, medium_path = $2, status = 'processed'
         WHERE id = $3`,
        [thumbnailPath, mediumPath, photoId]
      );

      consumerChannel.ack(msg);
    } catch (err) {
      console.error('[RabbitMQ] Error processing image.processed message:', err.message);
      // Reject and discard — don't requeue to avoid infinite loops
      consumerChannel.nack(msg, false, false);
    }
  });

  console.log('[RabbitMQ] gallery-service connected — publishing to photo_events, consuming from image_processed_queue');
}

/**
 * Publish a "photo uploaded" event so the image-processor can pick it up.
 */
async function publishPhotoUploaded(photoId, filePath) {
  if (!channel) {
    console.warn('[RabbitMQ] Channel not ready — skipping publish');
    return;
  }

  const payload = Buffer.from(JSON.stringify({
    photoId,
    filePath,
    timestamp: new Date().toISOString(),
  }));

  channel.publish(EXCHANGE, PUBLISH_KEY, payload, { persistent: true });
  console.log(`[RabbitMQ] photo.uploaded published for photo ${photoId}`);
}

module.exports = { setup, publishPhotoUploaded };
