"""Own-profile routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.deps import get_current_user
from app.errors import ApiError
from app.schemas import MeOut, PasswordChangeIn, ProfileUpdateIn

router = APIRouter(
    prefix="/api/profile",
    tags=["profile"],
    dependencies=[Depends(get_current_user)],
)


@router.patch("", response_model=MeOut)
def update_profile(payload: ProfileUpdateIn) -> MeOut:
    raise ApiError(501, "not_implemented", "Das Profil ist noch nicht verfügbar.")


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChangeIn) -> None:
    raise ApiError(501, "not_implemented", "Das Passwort ist noch nicht verfügbar.")


@router.post("/avatar", response_model=MeOut)
def upload_avatar(file: UploadFile = File(...)) -> MeOut:
    raise ApiError(501, "not_implemented", "Der Profilbild-Upload ist noch nicht verfügbar.")


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account() -> None:
    raise ApiError(501, "not_implemented", "Das Löschen des Kontos ist noch nicht verfügbar.")
