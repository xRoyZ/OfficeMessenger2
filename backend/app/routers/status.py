"""Image status routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.deps import get_current_user
from app.errors import ApiError
from app.schemas import StatusGroupOut, StatusItemOut, ViewerOut

router = APIRouter(
    prefix="/api/status",
    tags=["status"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[StatusGroupOut])
def list_statuses() -> list[StatusGroupOut]:
    raise ApiError(501, "not_implemented", "Der Status ist noch nicht verfügbar.")


@router.post("", response_model=StatusItemOut, status_code=status.HTTP_201_CREATED)
def create_status(
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
) -> StatusItemOut:
    raise ApiError(501, "not_implemented", "Der Status ist noch nicht verfügbar.")


@router.post("/{status_id}/view", status_code=status.HTTP_204_NO_CONTENT)
def view_status(status_id: uuid.UUID) -> None:
    raise ApiError(501, "not_implemented", "Der Status ist noch nicht verfügbar.")


@router.get("/{status_id}/viewers", response_model=list[ViewerOut])
def list_status_viewers(status_id: uuid.UUID) -> list[ViewerOut]:
    raise ApiError(501, "not_implemented", "Die Status-Betrachter sind noch nicht verfügbar.")
