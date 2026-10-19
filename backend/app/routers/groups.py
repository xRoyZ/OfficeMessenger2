"""Group creation and administration routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.deps import get_current_user
from app.errors import ApiError
from app.schemas import ChatOut, GroupCreateIn, GroupMemberIn, GroupUpdateIn

router = APIRouter(
    prefix="/api/groups",
    tags=["groups"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreateIn) -> ChatOut:
    raise ApiError(501, "not_implemented", "Das Anlegen von Gruppen ist noch nicht verfügbar.")


@router.patch("/{chat_id}", response_model=ChatOut)
def update_group(chat_id: uuid.UUID, payload: GroupUpdateIn) -> ChatOut:
    raise ApiError(501, "not_implemented", "Das Bearbeiten von Gruppen ist noch nicht verfügbar.")


@router.post("/{chat_id}/photo", response_model=ChatOut)
def upload_group_photo(chat_id: uuid.UUID, file: UploadFile = File(...)) -> ChatOut:
    raise ApiError(501, "not_implemented", "Das Gruppenfoto ist noch nicht verfügbar.")


@router.post("/{chat_id}/members", response_model=ChatOut)
def add_group_member(chat_id: uuid.UUID, payload: GroupMemberIn) -> ChatOut:
    raise ApiError(501, "not_implemented", "Mitglieder sind noch nicht verfügbar.")


@router.delete("/{chat_id}/members/{user_id}", response_model=ChatOut)
def remove_group_member(chat_id: uuid.UUID, user_id: uuid.UUID) -> ChatOut:
    raise ApiError(501, "not_implemented", "Mitglieder sind noch nicht verfügbar.")


@router.post("/{chat_id}/admins", response_model=ChatOut)
def promote_group_admin(chat_id: uuid.UUID, payload: GroupMemberIn) -> ChatOut:
    raise ApiError(501, "not_implemented", "Admin-Rechte sind noch nicht verfügbar.")


@router.delete("/{chat_id}/admins/{user_id}", response_model=ChatOut)
def demote_group_admin(chat_id: uuid.UUID, user_id: uuid.UUID) -> ChatOut:
    raise ApiError(501, "not_implemented", "Admin-Rechte sind noch nicht verfügbar.")


@router.post("/{chat_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_group(chat_id: uuid.UUID) -> None:
    raise ApiError(501, "not_implemented", "Das Verlassen von Gruppen ist noch nicht verfügbar.")
