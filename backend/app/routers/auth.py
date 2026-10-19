"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.deps import get_current_user
from app.errors import ApiError
from app.schemas import AuthOut, LoginIn, MeOut, RegisterIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn) -> AuthOut:
    raise ApiError(501, "not_implemented", "Die Registrierung ist noch nicht verfügbar.")


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn) -> AuthOut:
    raise ApiError(501, "not_implemented", "Die Anmeldung ist noch nicht verfügbar.")


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_user)],
)
def logout() -> None:
    raise ApiError(501, "not_implemented", "Das Abmelden ist noch nicht verfügbar.")


@router.get("/me", response_model=MeOut, dependencies=[Depends(get_current_user)])
def me() -> MeOut:
    raise ApiError(501, "not_implemented", "Das Profil ist noch nicht verfügbar.")
