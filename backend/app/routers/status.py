"""Image status routes.

Statuses are visible to every authenticated user for 24 hours after they are
posted.  Expiry is enforced in every query, so no background job is needed:
a row whose ``expires_at`` lies in the past is never returned and cannot be
opened or inspected any more.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.models import Status, StatusView, User
from app.schemas import StatusGroupOut, StatusItemOut, UserOut, ViewerOut
from app.services.uploads import save_image

router = APIRouter(
    prefix="/api/status",
    tags=["status"],
    dependencies=[Depends(get_current_user)],
)

STATUS_TTL = timedelta(hours=24)
MAX_CAPTION_LENGTH = 500


def _not_found() -> ApiError:
    return ApiError(404, "status_not_found", "Status nicht gefunden.")


def _live_status(status_id: uuid.UUID, db: Session) -> Status:
    """Return a status only while it is still alive, otherwise 404."""

    row = db.get(Status, status_id)
    if row is None or row.expires_at <= datetime.now(UTC):
        raise _not_found()
    return row


@router.get("", response_model=list[StatusGroupOut])
def list_statuses(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StatusGroupOut]:
    """Return every user with at least one live status, the caller first."""

    now = datetime.now(UTC)
    rows = db.execute(
        select(Status, User)
        .join(User, Status.user_id == User.id)
        .where(Status.expires_at > now)
        .order_by(Status.created_at.asc())
    ).all()

    if not rows:
        return []

    status_ids = [row[0].id for row in rows]
    viewer_counts = dict(
        db.execute(
            select(StatusView.status_id, func.count(StatusView.user_id))
            .where(StatusView.status_id.in_(status_ids))
            .group_by(StatusView.status_id)
        ).all()
    )
    seen_ids = set(
        db.scalars(
            select(StatusView.status_id).where(
                StatusView.user_id == user.id,
                StatusView.status_id.in_(status_ids),
            )
        ).all()
    )

    grouped: dict[uuid.UUID, tuple[User, list[StatusItemOut]]] = {}
    for status_row, owner in rows:
        item = StatusItemOut(
            id=status_row.id,
            image_url=status_row.image_url,
            caption=status_row.caption,
            created_at=status_row.created_at,
            expires_at=status_row.expires_at,
            seen=status_row.id in seen_ids,
            viewer_count=viewer_counts.get(status_row.id, 0),
        )
        grouped.setdefault(owner.id, (owner, []))[1].append(item)

    groups: list[StatusGroupOut] = []
    for owner_id, (owner, items) in grouped.items():
        is_own = owner_id == user.id
        has_unseen = False if is_own else any(not item.seen for item in items)
        groups.append(
            StatusGroupOut(
                user=UserOut.model_validate(owner),
                items=items,
                has_unseen=has_unseen,
                is_own=is_own,
            )
        )

    def sort_key(group: StatusGroupOut) -> tuple[int, datetime, str]:
        latest = max(item.created_at for item in group.items)
        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=UTC)
        return (0 if group.is_own else 1, -latest.timestamp(), group.user.display_name)

    groups.sort(key=sort_key)
    return groups


@router.post("", response_model=StatusItemOut, status_code=status.HTTP_201_CREATED)
def create_status(
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StatusItemOut:
    """Store an uploaded image and publish it as a 24-hour status."""

    cleaned_caption: str | None = None
    if caption is not None:
        cleaned_caption = caption.strip() or None
    if cleaned_caption is not None and len(cleaned_caption) > MAX_CAPTION_LENGTH:
        raise ApiError(
            422,
            "validation_error",
            f"Die Bildunterschrift darf höchstens {MAX_CAPTION_LENGTH} Zeichen lang sein.",
        )

    record = save_image(file, "status", user, db)

    created_at = datetime.now(UTC)
    status_row = Status(
        user_id=user.id,
        file_id=record.id,
        caption=cleaned_caption,
        created_at=created_at,
        expires_at=created_at + STATUS_TTL,
    )
    db.add(status_row)
    db.commit()
    db.refresh(status_row)

    return StatusItemOut(
        id=status_row.id,
        image_url=status_row.image_url,
        caption=status_row.caption,
        created_at=status_row.created_at,
        expires_at=status_row.expires_at,
        seen=False,
        viewer_count=0,
    )


@router.post("/{status_id}/view", status_code=status.HTTP_204_NO_CONTENT)
def view_status(
    status_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Record the caller as a viewer of a live status, idempotently."""

    status_row = _live_status(status_id, db)
    if status_row.user_id == user.id:
        return

    existing = db.get(StatusView, (status_row.id, user.id))
    if existing is None:
        db.add(StatusView(status_id=status_row.id, user_id=user.id))
        db.commit()


@router.get("/{status_id}/viewers", response_model=list[ViewerOut])
def list_status_viewers(
    status_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ViewerOut]:
    """List who viewed a status; only its owner may ask."""

    status_row = _live_status(status_id, db)
    if status_row.user_id != user.id:
        raise ApiError(403, "forbidden", "Nur der Besitzer darf die Betrachter sehen.")

    rows = db.execute(
        select(StatusView, User)
        .join(User, StatusView.user_id == User.id)
        .where(StatusView.status_id == status_row.id)
        .order_by(StatusView.viewed_at.asc())
    ).all()

    return [
        ViewerOut(
            user=UserOut.model_validate(viewer),
            viewed_at=view.viewed_at,
        )
        for view, viewer in rows
    ]
