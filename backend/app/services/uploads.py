"""Image upload storage.

The final signature is fixed here; the upload feature ticket fills the body.
"""

from __future__ import annotations

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import File, User


def save_image(upload: UploadFile, kind: str, owner: User, db: Session) -> File:
    """Validate and persist an uploaded image, returning the stored file row."""

    raise ApiError(
        501,
        "not_implemented",
        "Bild-Uploads sind noch nicht verfügbar.",
    )
