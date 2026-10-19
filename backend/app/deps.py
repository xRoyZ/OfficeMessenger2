"""Reusable FastAPI dependencies for authentication and chat permissions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.models import ChatMember, User
from app.models import Session as SessionRow
from app.services.security import hash_token

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> ApiError:
    return ApiError(401, "unauthorized", "Nicht angemeldet. Bitte melde dich an.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the Bearer token to its user or answer 401.

    A token is only valid while its session row exists, is not revoked and has
    not expired.
    """

    if credentials is None or not credentials.credentials:
        raise _unauthorized()

    token_hash = hash_token(credentials.credentials)
    session_row = db.scalar(select(SessionRow).where(SessionRow.token_hash == token_hash))
    if session_row is None or session_row.revoked_at is not None:
        raise _unauthorized()

    expires_at = session_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        raise _unauthorized()

    user = db.get(User, session_row.user_id)
    if user is None:
        raise _unauthorized()
    return user


def require_chat_membership(
    chat_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMember:
    """Return the caller's membership; a non-member sees 404, never 403."""

    membership = db.get(ChatMember, (chat_id, user.id))
    if membership is None:
        raise ApiError(404, "chat_not_found", "Chat nicht gefunden.")
    return membership


def require_group_admin(
    chat_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMember:
    """Return the caller's membership when it carries the admin role."""

    membership = require_chat_membership(chat_id=chat_id, user=user, db=db)
    if membership.role != "admin":
        raise ApiError(403, "forbidden", "Nur Admins dürfen diese Aktion ausführen.")
    return membership
