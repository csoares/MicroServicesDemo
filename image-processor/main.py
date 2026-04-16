"""
main.py — FastAPI entry point for the image-processing microservice.

This service is primarily an event consumer — it processes images in response to
RabbitMQ messages, not HTTP requests. FastAPI is used to expose a /health endpoint
and to demonstrate the framework. The real work happens in rabbitmq_client.py.

Teaching note:
  Not every microservice needs a REST API. Some services exist purely to consume
  events and perform background work. This pattern is common in data pipelines,
  notification systems, and media processing workflows.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from rabbitmq_client import start_consuming

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan event handler.
    Everything before the `yield` runs on startup; everything after runs on shutdown.
    """
    # Start RabbitMQ consumer as a background task so it doesn't block the server
    task = asyncio.create_task(start_consuming())
    logger.info("image-processor started")

    yield  # application is now running

    # Shutdown: cancel the consumer task
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("image-processor stopped")


app = FastAPI(
    title="Image Processing Service",
    description="Consumes photo.uploaded events, resizes images, publishes image.processed events.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    """Health check — used by Docker and service discovery."""
    return {"status": "ok", "service": "image-processor"}
