# smart_blog/image_utils.py
"""
Обработка изображений при загрузке:
- Ограничение ширины (max 1600px)
- Конвертация в WebP (качество 85-90%)
- Генерация thumbnail (~300px), medium (~800px), large (~1400-1600px)
- Проверка MIME и размера файла
- Удаление оригинального файла после успешной конвертации
"""
import io
import os
import logging
import hashlib
import time
from pathlib import Path

from PIL import Image
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.conf import settings

logger = logging.getLogger(__name__)

# Ограничения
MAX_IMAGE_WIDTH = 1600
MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB
ALLOWED_MIME_TYPES = frozenset({
    "image/jpeg", "image/jpg", "image/png", "image/webp"
})
WEBP_QUALITY = 88

# Размеры для responsive
SIZE_THUMBNAIL = 300
SIZE_MEDIUM = 800
SIZE_LARGE = 1600


def _get_content_type(ufile):
    """Извлекает MIME из UploadedFile."""
    ct = getattr(ufile, "content_type", None) or ""
    return ct.lower().strip()


def _validate_file(ufile):
    """
    Проверяет MIME-тип и размер файла.
    Raises ValueError при ошибке.
    """
    ct = _get_content_type(ufile)
    if ct not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported image type: {ct}")

    ufile.seek(0, 2)
    size = ufile.tell()
    ufile.seek(0)
    if size > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File too large ({size / (1024*1024):.1f} MB). Maximum allowed: {MAX_FILE_SIZE_BYTES / (1024*1024):.0f} MB"
        )


def _open_image(ufile):
    """Открывает изображение из UploadedFile, конвертирует в RGB (RGBA/CMYK/P/LA → RGB)."""
    ufile.seek(0)
    img = Image.open(ufile)
    if img.mode == "RGB":
        return img
    if img.mode == "RGBA":
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        return background
    return img.convert("RGB")


def _resize_to_max_width(img, max_width):
    """Масштабирует по ширине, сохраняя соотношение сторон."""
    w, h = img.size
    if w <= max_width:
        return img
    ratio = max_width / w
    new_h = int(h * ratio)
    return img.resize((max_width, new_h), Image.Resampling.LANCZOS)


def _save_webp(img, max_width, quality=WEBP_QUALITY):
    """
    Масштабирует и сохраняет в WebP формате.
    Возвращает (bytes, width, height).
    """
    resized = _resize_to_max_width(img, max_width)
    buf = io.BytesIO()
    resized.save(buf, format="WEBP", quality=quality, method=6)
    buf.seek(0)
    return buf.getvalue(), resized.width, resized.height


def _unique_filename(ufile, item_id, suffix):
    """Генерирует уникальное имя: items/{item_id}/{suffix}/{base}_{hash}_{ts}.webp"""
    ufile.seek(0)
    data = ufile.read(65536)
    ufile.seek(0)
    h = hashlib.sha256(data).hexdigest()[:12]
    ts = int(time.time() * 1000)
    base = "img"
    if getattr(ufile, "name", None):
        base = (Path(ufile.name).stem[:30] or "img").replace(" ", "_")
    return f"items/{item_id}/{suffix}/{base}_{h}_{ts}.webp"


def process_image(ufile, item_id):
    """
    Обрабатывает загруженное изображение:
    1. Проверяет MIME и размер
    2. Генерирует thumbnail, medium, large в WebP
    3. Удаляет оригинал после успешной конвертации (если временный файл)

    Args:
        ufile: UploadedFile (Django)
        item_id: int, id публикации

    Returns:
        dict: {
            "image": ContentFile или path для large,
            "image_thumbnail": ContentFile для thumbnail,
            "image_medium": ContentFile для medium,
            "width": int,
            "height": int,
        }

    Raises:
        ValueError: при невалидном файле
    """
    _validate_file(ufile)

    ufile.seek(0)
    img = _open_image(ufile)

    # Large (основное изображение)
    large_data, large_w, large_h = _save_webp(img, SIZE_LARGE)
    large_path = _unique_filename(ufile, item_id, "large")
    large_file = ContentFile(large_data, name=large_path)

    # Medium
    medium_data, _, _ = _save_webp(img, SIZE_MEDIUM)
    medium_path = _unique_filename(ufile, item_id, "medium")
    medium_file = ContentFile(medium_data, name=medium_path)

    # Thumbnail
    thumb_data, thumb_w, thumb_h = _save_webp(img, SIZE_THUMBNAIL)
    thumb_path = _unique_filename(ufile, item_id, "thumbnails")
    thumb_file = ContentFile(thumb_data, name=thumb_path)

    # Удаляем оригинал, если это временный загруженный файл
    try:
        if hasattr(ufile, "temporary_file_path"):
            tmp_path = ufile.temporary_file_path()
            if tmp_path and os.path.isfile(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    logger.warning("Could not remove temp file %s", tmp_path)
    except Exception:
        pass

    return {
        "image": large_file,
        "image_thumbnail": thumb_file,
        "image_medium": medium_file,
        "width": large_w,
        "height": large_h,
        "thumbnail_width": thumb_w,
        "thumbnail_height": thumb_h,
    }


def process_image_legacy_safe(ufile, item_id):
    """
    Обрабатывает изображение. При ошибке возвращает None (fallback на сохранение без обработки).
    """
    try:
        return process_image(ufile, item_id)
    except Exception as e:
        logger.exception("Image processing failed for item %s: %s", item_id, e)
        return None
