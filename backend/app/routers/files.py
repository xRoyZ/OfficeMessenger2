"""Authenticated file delivery route."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.models import File
from app.services.uploads import stored_path

router = APIRouter(
    prefix="/api/files",
    tags=["files"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/{file_id}", response_class=Response)
def download_file(file_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    """Stream a stored image to an authenticated caller."""

    record = db.get(File, file_id)
    if record is None:
        raise ApiError(404, "file_not_found", "Datei nicht gefunden.")

    path = stored_path(record.storage_name)
    if path is None or not path.is_file():
        raise ApiError(404, "file_not_found", "Datei nicht gefunden.")

    try:
        data = path.read_bytes()
    except OSError as exc:
        raise ApiError(404, "file_not_found", "Datei nicht gefunden.") from exc

    return Response(
        content=data,
        media_type=record.content_type,
        headers={
            "Content-Length": str(len(data)),
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )
