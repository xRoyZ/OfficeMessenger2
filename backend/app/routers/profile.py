"""Own-profile routes: update, avatar upload, password change and deletion."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import bearer_scheme, get_current_user
from app.errors import GENERIC_MESSAGES, ApiError
from app.models import ChatMember, Status, StatusView, User
from app.models import File as FileRow
from app.models import Session as SessionRow
from app.schemas import MeOut, PasswordChangeIn, ProfileUpdateIn
from app.services.security import hash_password, hash_token, verify_password
from app.services.uploads import save_image, stored_path

router = APIRouter(
    prefix="/api/profile",
    tags=["profile"],
    dependencies=[Depends(get_current_user)],
)

WRONG_PASSWORD_MESSAGE = "Das aktuelle Passwort ist nicht korrekt."

logger = logging.getLogger(__name__)


@router.patch("", response_model=MeOut)
def update_profile(
    payload: ProfileUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeOut:
    """Update the caller's display name and status text.

    A field that is absent from the request stays untouched; an explicit
    ``status_text`` of ``null`` clears the status text.
    """

    supplied = payload.model_fields_set

    if "display_name" in supplied:
        if payload.display_name is None:
            raise ApiError(422, "validation_error", GENERIC_MESSAGES[422][1])
        user.display_name = payload.display_name
    if "status_text" in supplied:
        user.status_text = payload.status_text

    db.commit()
    db.refresh(user)
    return user


@router.post("/avatar", response_model=MeOut)
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeOut:
    """Replace the caller's avatar with a freshly validated image upload.

    The file is validated and stored before the user row is touched, so a
    rejected upload leaves the previous avatar in place.
    """

    record = save_image(file, "avatar", user, db)

    user.avatar_file_id = record.id
    db.commit()
    db.refresh(user)
    return user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    """Change the password and revoke every session except the current one."""

    if not verify_password(payload.current_password, user.password_hash):
        raise ApiError(400, "invalid_password", WRONG_PASSWORD_MESSAGE)

    user.password_hash = hash_password(payload.new_password)

    current_hash = hash_token(credentials.credentials) if credentials else None
    revoke = update(SessionRow).where(
        SessionRow.user_id == user.id,
        SessionRow.revoked_at.is_(None),
    )
    if current_hash is not None:
        revoke = revoke.where(SessionRow.token_hash != current_hash)
    db.execute(revoke.values(revoked_at=datetime.now(UTC)))

    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete the account together with everything that keeps it retrievable.

    Sessions, chat memberships, own statuses, status views and the user's file
    rows are removed; the stored files are unlinked from disk after the
    transaction committed.  Afterwards neither the account nor any of its
    images can be reached through the API.
    """

    files = db.scalars(select(FileRow).where(FileRow.owner_id == user.id)).all()
    status_ids = list(db.scalars(select(Status.id).where(Status.user_id == user.id)))

    if status_ids:
        db.execute(delete(StatusView).where(StatusView.status_id.in_(status_ids)))
    db.execute(delete(StatusView).where(StatusView.user_id == user.id))
    db.execute(delete(Status).where(Status.user_id == user.id))
    db.execute(delete(ChatMember).where(ChatMember.user_id == user.id))
    db.execute(delete(FileRow).where(FileRow.owner_id == user.id))
    db.execute(delete(SessionRow).where(SessionRow.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()

    for record in files:
        path = stored_path(record.storage_name)
        if path is not None:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logger.warning(
                    "Could not remove stored file %s while deleting an account",
                    record.storage_name,
                )
