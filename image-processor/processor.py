"""
processor.py — Image resize and compression using Pillow + MinIO.

Images are downloaded from MinIO, processed in memory, and uploaded back.
No local filesystem needed — the container is fully stateless.

Teaching note:
  This module has no knowledge of HTTP or message queues.
  It only knows about images and object storage — good separation of concerns.
"""

import io
import os
import time

from minio import Minio
from PIL import Image

PROCESSING_DELAY = int(os.getenv("PROCESSING_DELAY", "0"))


def make_minio_client() -> Minio:
    return Minio(
        os.getenv("MINIO_ENDPOINT", "minio:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        secure=False,
    )


def process_image(minio_client: Minio, bucket: str, object_key: str, photo_id: str) -> dict:
    """
    Download the original image from MinIO, create two resized variants,
    upload them back, and return their object keys.

    Args:
        minio_client: initialised MinIO client
        bucket:       bucket name (e.g. 'photos')
        object_key:   key of the original (e.g. 'originals/uuid-file.jpg')
        photo_id:     UUID used to name the output objects

    Returns:
        dict with 'thumbnailKey' and 'mediumKey'
    """
    if PROCESSING_DELAY > 0:
        time.sleep(PROCESSING_DELAY)

    # ── Download original from MinIO ─────────────────────────────────────────
    response = minio_client.get_object(bucket, object_key)
    image_data = response.read()
    response.close()
    response.release_conn()

    img = Image.open(io.BytesIO(image_data))

    # convert("RGB") normalises all formats (PNG/RGBA, GIF palette…) to JPEG-compatible.
    # Without this, saving a PNG with an alpha channel as JPEG raises:
    #   OSError: cannot write mode RGBA as JPEG
    img = img.convert("RGB")

    # ── Thumbnail 200×200 ────────────────────────────────────────────────────
    thumb = img.copy()
    thumb.thumbnail((200, 200), Image.LANCZOS)
    thumb_buf = io.BytesIO()
    thumb.save(thumb_buf, "JPEG", quality=75, optimize=True)
    thumb_buf.seek(0)
    thumbnail_key = f"thumbnails/{photo_id}.jpg"
    minio_client.put_object(
        bucket, thumbnail_key, thumb_buf, len(thumb_buf.getvalue()),
        content_type="image/jpeg",
    )

    # ── Medium 800×600 ───────────────────────────────────────────────────────
    medium = img.copy()
    medium.thumbnail((800, 600), Image.LANCZOS)
    medium_buf = io.BytesIO()
    medium.save(medium_buf, "JPEG", quality=85, optimize=True)
    medium_buf.seek(0)
    medium_key = f"medium/{photo_id}.jpg"
    minio_client.put_object(
        bucket, medium_key, medium_buf, len(medium_buf.getvalue()),
        content_type="image/jpeg",
    )

    return {
        "thumbnailKey": thumbnail_key,
        "mediumKey":    medium_key,
    }
