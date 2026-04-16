'use strict';

const amqplib = require('amqplib');
const db      = require('./db');
const config  = require('./config');

const EXCHANGE      = 'photo_events';
const PUBLISH_KEY   = 'photo.uploaded';
const CONSUME_KEY   = 'image.processed';
const CONSUME_QUEUE = 'image_processed_queue';

let channel = null;

/**
 * Connect to RabbitMQ with a retry loop.
 * RabbitMQ takes ~10s to fully start; without retries the service crashes on boot.
 */
async function connectWithRetry(url, maxAttempts = 15) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const conn = await amqplib.connect(url);
      conn.on('error', (err) => console.error('RabbitMQ connection error:', err.message));
      conn.on('close', ()  => console.warn('RabbitMQ connection closed'));
      return conn;
    } catch (err) {
      console.log(`RabbitMQ not ready (attempt ${attempt}/${maxAttempts}): ${err.message} — retrying in 3s`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not connect to RabbitMQ after maximum attempts');
}

/**
 * Set up exchange, queues, and start consuming image.processed events.
 */
async function setup() {
  const conn = await connectWithRetry(config.rabbitmqUrl);

  const consumerChannel = await conn.createChannel();
  channel               = await conn.createChannel();

  await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
  await consumerChannel.assertExchange(EXCHANGE, 'direct', { durable: true });

  await consumerChannel.assertQueue(CONSUME_QUEUE, { durable: true });
  await consumerChannel.bindQueue(CONSUME_QUEUE, EXCHANGE, CONSUME_KEY);

  consumerChannel.prefetch(1);

  consumerChannel.consume(CONSUME_QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const { photoId, thumbnailKey, mediumKey } = JSON.parse(msg.content.toString());

      console.log(`[RabbitMQ] image.processed received for photo ${photoId}`);

      // Store URL-style paths so the API and frontend stay consistent.
      // Nginx proxies /uploads/* → MinIO bucket, so these paths resolve correctly.
      await db.query(
        `UPDATE photos
         SET thumbnail_path = $1, medium_path = $2, status = 'processed'
         WHERE id = $3`,
        [`/uploads/${thumbnailKey}`, `/uploads/${mediumKey}`, photoId]
      );

      consumerChannel.ack(msg);
    } catch (err) {
      console.error('[RabbitMQ] Error handling image.processed:', err.message);
      consumerChannel.nack(msg, false, false);
    }
  });

  console.log('[RabbitMQ] gallery-service ready');
}

/**
 * Publish a photo.uploaded event.
 * Sends the MinIO object key — not the file contents.
 * Teaching note: the queue carries metadata; the object store carries the data.
 *
 * @param {string} photoId   - UUID of the photos row
 * @param {string} objectKey - MinIO key, e.g. 'originals/uuid-photo.jpg'
 */
async function publishPhotoUploaded(photoId, objectKey) {
  if (!channel) {
    console.warn('[RabbitMQ] Channel not ready — skipping publish');
    return;
  }

  const payload = Buffer.from(JSON.stringify({
    photoId,
    objectKey,
    timestamp: new Date().toISOString(),
  }));

  channel.publish(EXCHANGE, PUBLISH_KEY, payload, { persistent: true });
  console.log(`[RabbitMQ] photo.uploaded published for photo ${photoId}`);
}

module.exports = { setup, publishPhotoUploaded };
