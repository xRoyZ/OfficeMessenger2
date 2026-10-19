"""Chat list and direct-chat routes."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_chat_membership
from app.errors import ApiError
from app.models import Chat, ChatMember, Message, User
from app.schemas import ChatMemberOut, ChatOut, DirectChatIn, LastMessageOut, UserOut

router = APIRouter(
    prefix="/api/chats",
    tags=["chats"],
    dependencies=[Depends(get_current_user)],
)

UNKNOWN_TITLE = "Unbekannt"


def _member_rows(db: Session, chat_id: uuid.UUID) -> list[tuple[ChatMember, User]]:
    """Return every membership of a chat together with its user, by display name."""

    return list(
        db.execute(
            select(ChatMember, User)
            .join(User, User.id == ChatMember.user_id)
            .where(ChatMember.chat_id == chat_id)
            .order_by(User.display_name)
        ).all()
    )


def _unread_count(db: Session, membership: ChatMember, user_id: uuid.UUID) -> int:
    stmt = select(func.count(Message.id)).where(
        Message.chat_id == membership.chat_id,
        or_(Message.sender_id.is_(None), Message.sender_id != user_id),
    )
    if membership.last_read_message_id is not None:
        stmt = stmt.where(Message.id > membership.last_read_message_id)
    return int(db.scalar(stmt) or 0)


def _last_message(db: Session, chat_id: uuid.UUID) -> Message | None:
    return db.scalar(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.id.desc()).limit(1)
    )


def _presentation(chat: Chat, counterpart: User | None) -> tuple[str, str | None]:
    """Return the title and photo shown for a chat in the caller's list."""

    if chat.kind == "group":
        return chat.name or UNKNOWN_TITLE, chat.photo_url
    if counterpart is None:
        return UNKNOWN_TITLE, None
    return counterpart.display_name, counterpart.avatar_url


def _last_message_out(db: Session, chat: Chat) -> tuple[LastMessageOut | None, datetime]:
    """Return the preview of the newest message and the chat's activity time."""

    last = _last_message(db, chat.id)
    if last is None:
        return None, chat.created_at

    sender_name: str | None = None
    if last.sender_id is not None:
        sender = db.get(User, last.sender_id)
        if sender is not None:
            sender_name = sender.display_name

    preview = LastMessageOut(
        text=last.text,
        sender_display_name=sender_name,
        created_at=last.created_at,
    )
    return preview, last.created_at


def build_chat_out(
    db: Session,
    chat: Chat,
    membership: ChatMember,
    current_user: User,
) -> ChatOut:
    """Assemble the wire shape of one chat from the caller's point of view."""

    members = _member_rows(db, chat.id)
    counterpart = None
    if chat.kind == "direct":
        counterpart = next(
            (member_user for member, member_user in members if member_user.id != current_user.id),
            None,
        )
    title, photo_url = _presentation(chat, counterpart)
    last_message, last_activity_at = _last_message_out(db, chat)

    member_entries: list[ChatMemberOut] = []
    if chat.kind == "group":
        member_entries = [
            ChatMemberOut(user=UserOut.model_validate(member_user), role=member.role)
            for member, member_user in members
        ]

    return ChatOut(
        id=chat.id,
        kind=chat.kind,
        title=title,
        photo_url=photo_url,
        role=membership.role,
        member_count=len(members),
        members=member_entries,
        unread_count=_unread_count(db, membership, current_user.id),
        last_activity_at=last_activity_at,
        last_message=last_message,
    )


@router.get("", response_model=list[ChatOut])
def list_chats(
    filter_: Literal["all", "unread", "groups", "direct"] = Query(default="all", alias="filter"),
    search: str | None = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatOut]:
    """Return the caller's chats, newest activity first, optionally narrowed."""

    rows = db.execute(
        select(ChatMember, Chat)
        .join(Chat, Chat.id == ChatMember.chat_id)
        .where(ChatMember.user_id == user.id)
    ).all()

    chats = [build_chat_out(db, chat, membership, user) for membership, chat in rows]

    if filter_ == "unread":
        chats = [chat for chat in chats if chat.unread_count > 0]
    elif filter_ == "groups":
        chats = [chat for chat in chats if chat.kind == "group"]
    elif filter_ == "direct":
        chats = [chat for chat in chats if chat.kind == "direct"]

    needle = (search or "").strip().casefold()
    if needle:
        chats = [chat for chat in chats if needle in chat.title.casefold()]

    chats.sort(key=_activity_key, reverse=True)
    return chats


def _activity_key(chat: ChatOut) -> datetime:
    if chat.last_activity_at is not None:
        return chat.last_activity_at
    if chat.last_message is not None:
        return chat.last_message.created_at
    return datetime.min.replace(tzinfo=UTC)


@router.post("/direct", response_model=ChatOut)
def open_direct_chat(
    payload: DirectChatIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Return the direct chat of both users, creating it on first use."""

    if payload.user_id == user.id:
        raise ApiError(400, "bad_request", "Ein Chat mit dir selbst ist nicht möglich.")

    other = db.get(User, payload.user_id)
    if other is None:
        raise ApiError(404, "user_not_found", "Nutzer nicht gefunden.")

    other_chats = select(ChatMember.chat_id).where(ChatMember.user_id == other.id)
    chat = db.scalar(
        select(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .where(
            Chat.kind == "direct",
            ChatMember.user_id == user.id,
            Chat.id.in_(other_chats),
        )
        .limit(1)
    )

    if chat is None:
        chat = Chat(kind="direct", created_by=user.id)
        db.add(chat)
        db.flush()
        db.add_all(
            [
                ChatMember(chat_id=chat.id, user_id=user.id, role="member"),
                ChatMember(chat_id=chat.id, user_id=other.id, role="member"),
            ]
        )
        db.commit()
        db.refresh(chat)

    membership = db.get(ChatMember, (chat.id, user.id))
    if membership is None:
        raise ApiError(404, "chat_not_found", "Chat nicht gefunden.")
    return build_chat_out(db, chat, membership, user)


@router.get("/{chat_id}", response_model=ChatOut)
def get_chat(
    chat_id: uuid.UUID,
    membership: ChatMember = Depends(require_chat_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Return one chat to its members; a non-member sees 404."""

    chat = db.get(Chat, chat_id)
    if chat is None:
        raise ApiError(404, "chat_not_found", "Chat nicht gefunden.")
    return build_chat_out(db, chat, membership, user)
