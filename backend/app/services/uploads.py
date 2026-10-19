"""Image upload storage.

Uploads are validated twice: the announced request size is refused by
:class:`UploadSizeLimitMiddleware` before the body is buffered, and
:func:`save_image` checks the limit again while streaming the bytes to disk.
Only JPEG, PNG and WebP images are accepted, identified by their magic bytes,
and every stored file gets a server-generated random name so a client-supplied
name can never influence the path.
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import get_settings
from app.errors import ApiError, error_response
from app.models import File, User

UPLOAD_CHUNK_SIZE = 64 * 1024

IMAGE_EXTENSIONS: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

INVALID_UPLOAD_MESSAGE = "Nur JPEG-, PNG- und WebP-Bilder sind erlaubt."
EMPTY_UPLOAD_MESSAGE = "Die hochgeladene Datei ist leer."


def _too_large_message(max_bytes: int) -> str:
    megabytes = max_bytes / (1024 * 1024)
    rendered = f"{megabytes:.0f}" if megabytes.is_integer() else f"{megabytes:.1f}"
    return f"Die Datei ist zu groß. Maximal {rendered} MB sind erlaubt."


def _too_large(max_bytes: int) -> ApiError:
    return ApiError(413, "payload_too_large", _too_large_message(max_bytes))


def _invalid() -> ApiError:
    return ApiError(400, "invalid_upload", INVALID_UPLOAD_MESSAGE)


def sniff_image_type(head: bytes) -> str | None:
    """Return the content type of an image identified by its magic bytes."""

    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(head) >= 12 and head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def _declared_type(upload: UploadFile) -> str:
    raw = upload.content_type or ""
    return raw.split(";", 1)[0].strip().lower()


def save_image(upload: UploadFile, kind: str, owner: User, db: Session) -> File:
    """Validate and persist an uploaded image, returning the stored file row.

    The declared content type and the sniffed magic bytes must both name one of
    JPEG, PNG or WebP.  The body is streamed to a random file name below
    ``UPLOAD_DIR``; exceeding the size limit removes the partial file and
    raises the uniform payload-too-large error.
    """

    settings = get_settings()
    max_bytes = settings.max_upload_bytes

    if upload.size is not None and upload.size > max_bytes:
        raise _too_large(max_bytes)

    declared = _declared_type(upload)
    if declared not in IMAGE_EXTENSIONS:
        raise _invalid()

    upload.file.seek(0)
    first = upload.file.read(UPLOAD_CHUNK_SIZE)
    if not first:
        raise ApiError(400, "invalid_upload", EMPTY_UPLOAD_MESSAGE)

    sniffed = sniff_image_type(first)
    if sniffed is None or sniffed != declared:
        raise _invalid()

    upload_dir = settings.upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"{secrets.token_hex(16)}{IMAGE_EXTENSIONS[declared]}"
    target = upload_dir / storage_name

    written = 0
    try:
        with target.open("xb") as handle:
            chunk = first
            while chunk:
                written += len(chunk)
                if written > max_bytes:
                    raise _too_large(max_bytes)
                handle.write(chunk)
                chunk = upload.file.read(UPLOAD_CHUNK_SIZE)

        record = File(
            owner_id=owner.id,
            storage_name=storage_name,
            content_type=declared,
            size=written,
            kind=kind,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    except BaseException:
        target.unlink(missing_ok=True)
        raise

    return record


def stored_path(storage_name: str) -> Path | None:
    """Resolve a stored file name, refusing anything outside ``UPLOAD_DIR``."""

    upload_dir = get_settings().upload_dir.resolve()
    candidate = (upload_dir / storage_name).resolve()
    if candidate.parent != upload_dir:
        return None
    return candidate


class UploadSizeLimitMiddleware:
    """Refuse an announced request body above the upload limit before reading it.

    ``Content-Length`` is available on the ASGI scope before the request body is
    consumed, so an oversized upload is answered immediately with the uniform
    error body (AC-27) instead of being buffered into memory or a spool file.
    """

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            content_length = self._content_length(scope)
            if content_length is not None and content_length > self.max_bytes:
                response = error_response(
                    413,
                    "payload_too_large",
                    _too_large_message(self.max_bytes),
                )
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)

    @staticmethod
    def _content_length(scope: Scope) -> int | None:
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    return int(value)
                except ValueError:
                    return None
        return None
