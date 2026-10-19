"""Group creation and administration routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_chat_membership, require_group_admin
from app.errors import ApiError
from app.models import Chat, ChatMember, Message, User
from app.routers.chats import build_chat_out
from app.schemas import ChatOut, GroupCreateIn, GroupMemberIn, GroupUpdateIn, WsEvent
from app.services.realtime import manager
from app.services.uploads import save_image

router = APIRouter(
    prefix="/api/groups",
    tags=["groups"],
    dependencies=[Depends(get_current_user)],
)

LAST_ADMIN_MESSAGE = (
    "Die letzte Admin-Person kann die Gruppe nicht verlassen oder sich selbst "
    "degradieren. Benenne zuerst eine andere Person zur Admin-Person."
)


def _not_found() -> ApiError:
    return ApiError(404, "chat_not_found", "Gruppe nicht gefunden.")


def _last_admin_error() -> ApiError:
    return ApiError(400, "last_admin", LAST_ADMIN_MESSAGE)


def _load_group(db: Session, chat_id: uuid.UUID) -> Chat:
    """Return the group chat or answer 404 for an unknown/non-group id."""

    chat = db.get(Chat, chat_id)
    if chat is None or chat.kind != "group":
        raise _not_found()
    return chat


def _members(db: Session, chat_id: uuid.UUID) -> list[ChatMember]:
    return list(db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id)).all())


def _member(db: Session, chat_id: uuid.UUID, user_id: uuid.UUID) -> ChatMember | None:
    return db.get(ChatMember, (chat_id, user_id))


def _admin_count(db: Session, chat_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(ChatMember)
            .where(ChatMember.chat_id == chat_id, ChatMember.role == "admin")
        )
        or 0
    )


def _user_name(db: Session, user_id: uuid.UUID) -> str:
    user = db.get(User, user_id)
    return user.display_name if user is not None else "Unbekannt"


def _system_message(db: Session, chat_id: uuid.UUID, text: str) -> None:
    db.add(Message(chat_id=chat_id, sender_id=None, kind="system", text=text))


async def _broadcast(db: Session, chat_id: uuid.UUID) -> None:
    recipients = [member.user_id for member in _members(db, chat_id)]
    await manager.broadcast_to_users(recipients, WsEvent(type="chat:updated", chat_id=chat_id))


@router.post("", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: GroupCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Create a group with the caller as admin and every listed user as member."""

    member_ids = {member_id for member_id in payload.member_ids if member_id != user.id}
    if not member_ids:
        raise ApiError(
            400,
            "invalid_members",
            "Eine Gruppe braucht mindestens ein Mitglied außer dir.",
        )

    found_ids = set(db.scalars(select(User.id).where(User.id.in_(member_ids))).all())
    unknown_ids = member_ids - found_ids
    if unknown_ids:
        raise ApiError(400, "invalid_members", "Mindestens ein Mitglied wurde nicht gefunden.")

    chat = Chat(kind="group", name=payload.name, created_by=user.id)
    db.add(chat)
    db.flush()

    db.add(ChatMember(chat_id=chat.id, user_id=user.id, role="admin"))
    for member_id in sorted(found_ids):
        db.add(ChatMember(chat_id=chat.id, user_id=member_id, role="member"))

    db.commit()
    db.refresh(chat)

    membership = _member(db, chat.id, user.id)
    assert membership is not None
    result = build_chat_out(db, chat, membership, user)
    await _broadcast(db, chat.id)
    return result


@router.patch("/{chat_id}", response_model=ChatOut)
async def update_group(
    chat_id: uuid.UUID,
    payload: GroupUpdateIn,
    user: User = Depends(get_current_user),
    membership: ChatMember = Depends(require_group_admin),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Rename a group; admins only."""

    chat = _load_group(db, chat_id)
    chat.name = payload.name
    db.commit()
    db.refresh(chat)

    result = build_chat_out(db, chat, membership, user)
    await _broadcast(db, chat_id)
    return result


@router.post("/{chat_id}/photo", response_model=ChatOut)
async def upload_group_photo(
    chat_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    membership: ChatMember = Depends(require_group_admin),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Replace the group photo; admins only."""

    chat = _load_group(db, chat_id)
    record = save_image(file, "group_photo", user, db)

    chat.photo_file_id = record.id
    db.commit()
    db.refresh(chat)

    result = build_chat_out(db, chat, membership, user)
    await _broadcast(db, chat_id)
    return result


@router.post("/{chat_id}/members", response_model=ChatOut)
async def add_group_member(
    chat_id: uuid.UUID,
    payload: GroupMemberIn,
    user: User = Depends(get_current_user),
    membership: ChatMember = Depends(require_group_admin),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Add a user to the group; admins only."""

    chat = _load_group(db, chat_id)

    target = db.get(User, payload.user_id)
    if target is None:
        raise ApiError(404, "user_not_found", "Nutzer nicht gefunden.")

    existing = _member(db, chat_id, payload.user_id)
    if existing is None:
        db.add(ChatMember(chat_id=chat_id, user_id=payload.user_id, role="member"))
        _system_message(
            db,
            chat_id,
            f"{user.display_name} hat {target.display_name} zur Gruppe hinzugefügt",
        )
        db.commit()
        await _broadcast(db, chat_id)

    return build_chat_out(db, chat, membership, user)


@router.delete("/{chat_id}/members/{user_id}", response_model=ChatOut)
async def remove_group_member(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    membership: ChatMember = Depends(require_group_admin),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Remove a member and their membership row; admins only."""

    chat = _load_group(db, chat_id)

    target_membership = _member(db, chat_id, user_id)
    if target_membership is None:
        raise ApiError(404, "member_not_found", "Mitglied nicht gefunden.")

    if target_membership.role == "admin" and _admin_count(db, chat_id) <= 1:
        raise _last_admin_error()

    target_name = _user_name(db, user_id)
    db.delete(target_membership)
    _system_message(db, chat_id, f"{user.display_name} hat {target_name} aus der Gruppe entfernt")
    db.commit()
    await _broadcast(db, chat_id)

    return build_chat_out(db, chat, membership, user)


@router.post("/{chat_id}/admins", response_model=ChatOut)
async def promote_group_admin(
    chat_id: uuid.UUID,
    payload: GroupMemberIn,
    user: User = Depends(get_current_user),
    membership: ChatMember = Depends(require_group_admin),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Promote a member to admin; admins only."""

    chat = _load_group(db, chat_id)

    target_membership = _member(db, chat_id, payload.user_id)
    if target_membership is None:
        raise ApiError(404, "member_not_found", "Mitglied nicht gefunden.")

    if target_membership.role != "admin":
        target_name = _user_name(db, payload.user_id)
        target_membership.role = "admin"
        _system_message(db, chat_id, f"{user.display_name} hat {target_name} zum Admin gemacht")
        db.commit()
        await _broadcast(db, chat_id)

    return build_chat_out(db, chat, membership, user)


@router.delete("/{chat_id}/admins/{user_id}", response_model=ChatOut)
async def demote_group_admin(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    membership: ChatMember = Depends(require_group_admin),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Demote an admin to member; the last remaining admin cannot be demoted."""

    chat = _load_group(db, chat_id)

    target_membership = _member(db, chat_id, user_id)
    if target_membership is None:
        raise ApiError(404, "member_not_found", "Mitglied nicht gefunden.")

    if target_membership.role == "admin":
        if _admin_count(db, chat_id) <= 1:
            raise _last_admin_error()
        target_name = _user_name(db, user_id)
        target_membership.role = "member"
        _system_message(db, chat_id, f"{user.display_name} hat {target_name} zum Mitglied gemacht")
        db.commit()
        await _broadcast(db, chat_id)

    return build_chat_out(db, chat, membership, user)


@router.post("/{chat_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    chat_id: uuid.UUID,
    user: User = Depends(get_current_user),
    membership: ChatMember = Depends(require_chat_membership),
    db: Session = Depends(get_db),
) -> None:
    """Leave a group; the last remaining admin must hand over first."""

    _load_group(db, chat_id)

    if membership.role == "admin" and _admin_count(db, chat_id) <= 1:
        raise _last_admin_error()

    db.delete(membership)
    _system_message(db, chat_id, f"{user.display_name} hat die Gruppe verlassen")
    db.commit()
    await _broadcast(db, chat_id)
