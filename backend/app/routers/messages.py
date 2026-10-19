"""Message history, sending, read receipts and the live WebSocket."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, WebSocket, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.models import Session as SessionRow
from app.schemas import MessageCreateIn, MessageOut, MessagePage, ReadReceiptIn
from app.services.security import hash_token

router = APIRouter(prefix="/api", tags=["messages"])


@router.get(
    "/chats/{chat_id}/messages",
    response_model=MessagePage,
    dependencies=[Depends(get_current_user)],
)
def list_messages(
    chat_id: uuid.UUID,
    before: int | None = Query(default=None, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
) -> MessagePage:
    raise ApiError(501, "not_implemented", "Der Nachrichtenverlauf ist noch nicht verfügbar.")


@router.post(
    "/chats/{chat_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_user)],
)
def send_message(chat_id: uuid.UUID, payload: MessageCreateIn) -> MessageOut:
    raise ApiError(501, "not_implemented", "Das Senden von Nachrichten ist noch nicht verfügbar.")


@router.post(
    "/chats/{chat_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_user)],
)
def mark_read(chat_id: uuid.UUID, payload: ReadReceiptIn) -> None:
    raise ApiError(501, "not_implemented", "Lesebestätigungen sind noch nicht verfügbar.")


def _token_is_valid(db: Session, token: str) -> bool:
    session_row = db.scalar(select(SessionRow).where(SessionRow.token_hash == hash_token(token)))
    if session_row is None or session_row.revoked_at is not None:
        return False
    expires_at = session_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at > datetime.now(UTC)


@router.websocket("/ws")
async def realtime_socket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> None:
    await websocket.accept()
    if token is None or not _token_is_valid(db, token):
        await websocket.close(code=4401)
        return
    await websocket.close(code=1011)
