"""
processor.py — Image resize and compression using Pillow.

Teaching note:
  This module has no knowledge of HTTP or message queues.
  It only knows about files and images — good separation of concerns.
"""

import os
import time
from PIL import Image

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/uploads")

# Set PROCESSING_DELAY (seconds) in docker-compose.yml to simulate a slow
# processing pipeline — useful in class to show the pending → processed transition.
PROCESSING_DELAY = int(os.getenv("PROCESSING_DELAY", "0"))


def process_image(original_path: str, photo_id: str) -> dict:
    """
    Open the original image, create two resized/compressed variants, and return
    their paths.

    Returns:
        dict with 'thumbnailPath' and 'mediumPath' keys.
    """
    if PROCESSING_DELAY > 0:
        time.sleep(PROCESSING_DELAY)

    with Image.open(original_path) as img:
        # convert("RGB") normalises all formats (PNG/RGBA, GIF palette, etc.) to JPEG-compatible.
        # Without this, saving a PNG with an alpha channel as JPEG raises:
        #   OSError: cannot write mode RGBA as JPEG
        img = img.convert("RGB")

        # ── Thumbnail 200×200 ────────────────────────────────────────────────
        # Image.thumbnail() preserves the aspect ratio and never upscales.
        thumb = img.copy()
        thumb.thumbnail((200, 200), Image.LANCZOS)
        thumb_path = os.path.join(UPLOAD_DIR, "thumbnails", f"{photo_id}.jpg")
        os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
        thumb.save(thumb_path, "JPEG", quality=75, optimize=True)

        # ── Medium 800×600 ───────────────────────────────────────────────────
        medium = img.copy()
        medium.thumbnail((800, 600), Image.LANCZOS)
        medium_path = os.path.join(UPLOAD_DIR, "medium", f"{photo_id}.jpg")
        os.makedirs(os.path.dirname(medium_path), exist_ok=True)
        medium.save(medium_path, "JPEG", quality=85, optimize=True)

    return {
        "thumbnailPath": thumb_path,
        "mediumPath":    medium_path,
    }
