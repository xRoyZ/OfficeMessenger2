"""Chat list and direct-chat routes."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.deps import get_current_user
from app.errors import ApiError
from app.schemas import ChatOut, DirectChatIn

router = APIRouter(
    prefix="/api/chats",
    tags=["chats"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[ChatOut])
def list_chats(
    filter_: Literal["all", "unread", "groups", "direct"] = Query(default="all", alias="filter"),
    search: str | None = Query(default=None, max_length=100),
) -> list[ChatOut]:
    raise ApiError(501, "not_implemented", "Die Chatliste ist noch nicht verfügbar.")


@router.post("/direct", response_model=ChatOut)
def open_direct_chat(payload: DirectChatIn) -> ChatOut:
    raise ApiError(501, "not_implemented", "Direktchats sind noch nicht verfügbar.")


@router.get("/{chat_id}", response_model=ChatOut)
def get_chat(chat_id: uuid.UUID) -> ChatOut:
    raise ApiError(501, "not_implemented", "Der Chat ist noch nicht verfügbar.")
