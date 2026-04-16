"""
rabbitmq_client.py — Async RabbitMQ consumer/publisher using aio-pika.

Architecture:
  - Consumes:  exchange=photo_events, routing_key=photo.uploaded
  - Publishes: exchange=photo_events, routing_key=image.processed

aio-pika.connect_robust() handles reconnection automatically with exponential
back-off — no manual retry loop needed.
"""

import asyncio
import json
import logging
import os

import aio_pika

from processor import process_image

logger = logging.getLogger(__name__)

RABBITMQ_URL  = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
EXCHANGE_NAME = "photo_events"
CONSUME_QUEUE = "photo_upload_queue"
PUBLISH_KEY   = "image.processed"
CONSUME_KEY   = "photo.uploaded"


async def on_message(message: aio_pika.IncomingMessage, exchange: aio_pika.Exchange) -> None:
    """
    Handle a single 'photo.uploaded' message:
      1. Parse the photo metadata.
      2. Process the image with Pillow.
      3. Publish an 'image.processed' event back to the exchange.
      4. Acknowledge the original message.
    """
    async with message.process(requeue=False):  # nack+discard on exception
        try:
            payload    = json.loads(message.body)
            photo_id   = payload["photoId"]
            file_path  = payload["filePath"]

            logger.info(f"Processing photo {photo_id} at {file_path}")

            # Run Pillow (CPU-bound) in a thread pool so we don't block the event loop
            loop   = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, process_image, file_path, photo_id)

            logger.info(f"Done: thumb={result['thumbnailPath']} medium={result['mediumPath']}")

            # Notify the gallery-service that processing is complete
            response_body = json.dumps({
                "photoId":       photo_id,
                "thumbnailPath": result["thumbnailPath"],
                "mediumPath":    result["mediumPath"],
            }).encode()

            await exchange.publish(
                aio_pika.Message(
                    body         = response_body,
                    delivery_mode= aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=PUBLISH_KEY,
            )

        except Exception as exc:
            logger.error(f"Failed to process message: {exc}", exc_info=True)
            # message.process(requeue=False) will nack the message on exception


async def start_consuming() -> None:
    """
    Connect to RabbitMQ and start the consumer loop.
    Called from the FastAPI lifespan hook so it runs as a background task.
    """
    logger.info("Connecting to RabbitMQ…")

    # connect_robust retries automatically on connection failure
    connection = await aio_pika.connect_robust(RABBITMQ_URL)

    channel  = await connection.channel()
    await channel.set_qos(prefetch_count=1)  # process one message at a time

    # Declare exchange (idempotent — all services declare the same exchange)
    exchange = await channel.declare_exchange(
        EXCHANGE_NAME,
        aio_pika.ExchangeType.DIRECT,
        durable=True,
    )

    # Declare and bind the queue for incoming "photo.uploaded" events
    queue = await channel.declare_queue(CONSUME_QUEUE, durable=True)
    await queue.bind(exchange, routing_key=CONSUME_KEY)

    # Also declare the "image_processed_queue" so gallery-service can bind to it
    # even if it starts after us
    processed_queue = await channel.declare_queue("image_processed_queue", durable=True)
    await processed_queue.bind(exchange, routing_key=PUBLISH_KEY)

    logger.info("image-processor ready — listening on photo_upload_queue")

    # Start consuming — this registers an async callback and returns immediately
    await queue.consume(lambda msg: on_message(msg, exchange))
