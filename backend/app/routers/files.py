"""Authenticated file delivery route."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response

from app.deps import get_current_user
from app.errors import ApiError

router = APIRouter(
    prefix="/api/files",
    tags=["files"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/{file_id}", response_class=Response)
def download_file(file_id: uuid.UUID) -> Response:
    raise ApiError(501, "not_implemented", "Der Datei-Download ist noch nicht verfügbar.")
