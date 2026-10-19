"""User directory routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.deps import get_current_user
from app.errors import ApiError
from app.schemas import UserOut

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[UserOut])
def list_users(search: str | None = Query(default=None, max_length=100)) -> list[UserOut]:
    raise ApiError(501, "not_implemented", "Das Nutzerverzeichnis ist noch nicht verfügbar.")


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: uuid.UUID) -> UserOut:
    raise ApiError(501, "not_implemented", "Das Nutzerprofil ist noch nicht verfügbar.")
