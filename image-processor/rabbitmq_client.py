"""
rabbitmq_client.py — Async RabbitMQ consumer/publisher using aio-pika.

Consumes:  exchange=photo_events, routing_key=photo.uploaded
           message: { photoId, objectKey }

Publishes: exchange=photo_events, routing_key=image.processed
           message: { photoId, thumbnailKey, mediumKey }

aio-pika.connect_robust() handles reconnection automatically.
"""

import asyncio
import json
import logging
import os

import aio_pika

from processor import make_minio_client, process_image

logger = logging.getLogger(__name__)

RABBITMQ_URL  = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
MINIO_BUCKET  = os.getenv("MINIO_BUCKET", "photos")
EXCHANGE_NAME = "photo_events"
CONSUME_QUEUE = "photo_upload_queue"
CONSUME_KEY   = "photo.uploaded"
PUBLISH_KEY   = "image.processed"

# One MinIO client shared across all messages (thread-safe for reads/writes)
_minio = make_minio_client()


async def on_message(message: aio_pika.IncomingMessage, exchange: aio_pika.Exchange) -> None:
    """
    Handle a single photo.uploaded message:
      1. Parse photoId + objectKey from the message body.
      2. Download original from MinIO, resize with Pillow, upload back.
      3. Publish image.processed event with the new object keys.
      4. Acknowledge the message.
    """
    async with message.process(requeue=False):  # nack+discard on exception
        try:
            payload    = json.loads(message.body)
            photo_id   = payload["photoId"]
            object_key = payload["objectKey"]

            logger.info(f"Processing photo {photo_id} — key: {object_key}")

            # Pillow is CPU-bound; run in a thread pool to avoid blocking the event loop
            loop   = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, process_image, _minio, MINIO_BUCKET, object_key, photo_id
            )

            logger.info(
                f"Done: thumbnail={result['thumbnailKey']}  medium={result['mediumKey']}"
            )

            # Notify gallery-service
            response_body = json.dumps({
                "photoId":      photo_id,
                "thumbnailKey": result["thumbnailKey"],
                "mediumKey":    result["mediumKey"],
            }).encode()

            await exchange.publish(
                aio_pika.Message(
                    body=response_body,
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=PUBLISH_KEY,
            )

        except Exception as exc:
            logger.error(f"Failed to process message: {exc}", exc_info=True)


async def start_consuming() -> None:
    """Connect to RabbitMQ and start consuming photo.uploaded events."""
    logger.info("Connecting to RabbitMQ…")

    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    channel    = await connection.channel()
    await channel.set_qos(prefetch_count=1)

    exchange = await channel.declare_exchange(
        EXCHANGE_NAME, aio_pika.ExchangeType.DIRECT, durable=True
    )

    queue = await channel.declare_queue(CONSUME_QUEUE, durable=True)
    await queue.bind(exchange, routing_key=CONSUME_KEY)

    processed_queue = await channel.declare_queue("image_processed_queue", durable=True)
    await processed_queue.bind(exchange, routing_key=PUBLISH_KEY)

    logger.info("image-processor ready — listening on photo_upload_queue")
    await queue.consume(lambda msg: on_message(msg, exchange))
