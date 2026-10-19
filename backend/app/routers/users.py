"""User directory routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.models import User
from app.schemas import UserOut

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(get_current_user)],
)


def _like_pattern(term: str) -> str:
    """Build a case-insensitive LIKE pattern with wildcards escaped."""

    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@router.get("", response_model=list[UserOut])
def list_users(
    search: str | None = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    """List every other user, optionally filtered by name or e-mail prefix."""

    statement = select(User).where(User.id != user.id)
    term = (search or "").strip()
    if term:
        email_prefix = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        statement = statement.where(
            or_(
                User.display_name.ilike(_like_pattern(term), escape="\\"),
                User.email.ilike(email_prefix, escape="\\"),
            )
        )
    statement = statement.order_by(User.display_name, User.id)

    users = db.scalars(statement).all()
    return [UserOut.model_validate(row) for row in users]


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    """Return one user profile or a uniform 404 for an unknown id."""

    user = db.get(User, user_id)
    if user is None:
        raise ApiError(404, "user_not_found", "Nutzer nicht gefunden.")
    return UserOut.model_validate(user)
