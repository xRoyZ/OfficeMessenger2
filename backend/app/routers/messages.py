"""Message history, sending, read receipts and the live WebSocket."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_chat_membership
from app.errors import ApiError
from app.models import ChatMember, Message, User
from app.models import Session as SessionRow
from app.schemas import MessageCreateIn, MessageOut, MessagePage, ReadReceiptIn, UserOut, WsEvent
from app.services.realtime import manager
from app.services.security import hash_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["messages"])


def _members(db: Session, chat_id: uuid.UUID) -> list[ChatMember]:
    return list(db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id)).all())


def _is_read(message: Message, members: list[ChatMember]) -> bool:
    """A message counts as read once another member reached its id.

    The sender's own read cursor is ignored: the receipt describes whether a
    recipient has seen the message, which is what the check marks show.  In a
    direct chat "another member" is the counterpart; in a group any other
    member who read that far is enough.
    """

    for member in members:
        if message.sender_id is not None and member.user_id == message.sender_id:
            continue
        cursor = member.last_read_message_id
        if cursor is not None and cursor >= message.id:
            return True
    return False


def _message_out(message: Message, sender: User | None, members: list[ChatMember]) -> MessageOut:
    return MessageOut(
        id=message.id,
        chat_id=message.chat_id,
        kind=message.kind,
        text=message.text,
        sender=UserOut.model_validate(sender) if sender is not None else None,
        created_at=message.created_at,
        is_read=_is_read(message, members),
    )


def _load_senders(db: Session, messages: list[Message]) -> dict[uuid.UUID, User]:
    sender_ids = {message.sender_id for message in messages if message.sender_id is not None}
    if not sender_ids:
        return {}
    users = db.scalars(select(User).where(User.id.in_(sender_ids))).all()
    return {user.id: user for user in users}


@router.get("/chats/{chat_id}/messages", response_model=MessagePage)
def list_messages(
    chat_id: uuid.UUID,
    before: int | None = Query(default=None, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
    membership: ChatMember = Depends(require_chat_membership),
    db: Session = Depends(get_db),
) -> MessagePage:
    """Return a page of messages with the newest entry last."""

    query = select(Message).where(Message.chat_id == chat_id)
    if before is not None:
        query = query.where(Message.id < before)
    query = query.order_by(Message.id.desc()).limit(limit + 1)

    rows = list(db.scalars(query).all())
    has_more = len(rows) > limit
    page_rows = rows[:limit]
    page_rows.reverse()

    members = _members(db, chat_id)
    senders = _load_senders(db, page_rows)
    items = [
        _message_out(
            message, senders.get(message.sender_id) if message.sender_id else None, members
        )
        for message in page_rows
    ]
    return MessagePage(items=items, has_more=has_more)


@router.post(
    "/chats/{chat_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    chat_id: uuid.UUID,
    payload: MessageCreateIn,
    membership: ChatMember = Depends(require_chat_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    """Store a text message and push it to the other members."""

    message = Message(
        chat_id=chat_id,
        sender_id=user.id,
        kind="text",
        text=payload.text,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    members = _members(db, chat_id)
    result = _message_out(message, user, members)

    recipients = [member.user_id for member in members if member.user_id != user.id]
    if recipients:
        await manager.broadcast_to_users(
            recipients,
            WsEvent(type="message:new", chat_id=chat_id, message=result),
        )

    return result


@router.post("/chats/{chat_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    chat_id: uuid.UUID,
    payload: ReadReceiptIn,
    membership: ChatMember = Depends(require_chat_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Advance the caller's read cursor and notify the other members."""

    message = db.get(Message, payload.last_message_id)
    if message is None or message.chat_id != chat_id:
        raise ApiError(404, "message_not_found", "Nachricht nicht gefunden.")

    current = membership.last_read_message_id or 0
    if payload.last_message_id <= current:
        return

    membership.last_read_message_id = payload.last_message_id
    db.commit()

    members = _members(db, chat_id)
    recipients = [member.user_id for member in members if member.user_id != user.id]
    if recipients:
        await manager.broadcast_to_users(
            recipients,
            WsEvent(
                type="message:read",
                chat_id=chat_id,
                last_read_message_id=payload.last_message_id,
                reader_id=user.id,
            ),
        )


def _session_user_id(db: Session, token: str) -> uuid.UUID | None:
    """Return the session's user when the token is valid, unrevoked and unexpired."""

    session_row = db.scalar(select(SessionRow).where(SessionRow.token_hash == hash_token(token)))
    if session_row is None or session_row.revoked_at is not None:
        return None
    expires_at = session_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        return None
    return session_row.user_id


@router.websocket("/ws")
async def realtime_socket(
    websocket: WebSocket,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> None:
    """Accept only authenticated sessions; close with 4401 otherwise."""

    await websocket.accept()
    user_id = _session_user_id(db, token) if token else None
    if user_id is None:
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)
