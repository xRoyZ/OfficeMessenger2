"""Authentication routes: registration, login, logout and the current user."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import bearer_scheme, get_current_user
from app.errors import ApiError
from app.models import Session as SessionRow
from app.models import User
from app.schemas import AuthOut, LoginIn, MeOut, RegisterIn
from app.services.ratelimit import (
    SlidingWindowLimiter,
    client_key,
    login_limiter,
    register_limiter,
)
from app.services.security import hash_password, hash_token, issue_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_TAKEN_MESSAGE = "Diese E-Mail-Adresse ist bereits registriert."
INVALID_CREDENTIALS_MESSAGE = "E-Mail-Adresse oder Passwort ist falsch."
RATE_LIMITED_MESSAGE = "Zu viele Versuche. Bitte warte einen Moment."


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def _reject_when_limited(limiter: SlidingWindowLimiter, request: Request) -> str:
    key = client_key(request)
    if limiter.is_limited(key):
        raise ApiError(429, "rate_limited", RATE_LIMITED_MESSAGE)
    return key


def _open_session(db: Session, user: User) -> str:
    token = issue_token()
    expires_at = datetime.now(UTC) + timedelta(hours=get_settings().token_ttl_hours)
    db.add(
        SessionRow(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=expires_at,
        )
    )
    db.commit()
    return token


def _auth_out(token: str, user: User) -> AuthOut:
    return AuthOut(access_token=token, user=MeOut.model_validate(user))


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, db: Session = Depends(get_db)) -> AuthOut:
    limiter_key = _reject_when_limited(register_limiter, request)

    email = _normalise_email(str(payload.email))
    existing = db.scalar(select(User).where(func.lower(User.email) == email))
    if existing is not None:
        register_limiter.record_failure(limiter_key)
        raise ApiError(409, "email_taken", EMAIL_TAKEN_MESSAGE)

    user = User(
        email=email,
        display_name=payload.display_name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        register_limiter.record_failure(limiter_key)
        raise ApiError(409, "email_taken", EMAIL_TAKEN_MESSAGE) from None

    token = _open_session(db, user)
    register_limiter.reset(limiter_key)
    return _auth_out(token, user)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> AuthOut:
    limiter_key = _reject_when_limited(login_limiter, request)

    email = _normalise_email(str(payload.email))
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        login_limiter.record_failure(limiter_key)
        raise ApiError(401, "generic", INVALID_CREDENTIALS_MESSAGE)

    login_limiter.reset(limiter_key)
    token = _open_session(db, user)
    return _auth_out(token, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if credentials is None or not credentials.credentials:
        raise ApiError(401, "unauthorized", "Nicht angemeldet. Bitte melde dich an.")

    session_row = db.scalar(
        select(SessionRow).where(SessionRow.token_hash == hash_token(credentials.credentials))
    )
    if session_row is not None and session_row.revoked_at is None:
        session_row.revoked_at = datetime.now(UTC)
        db.commit()


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)) -> MeOut:
    return MeOut.model_validate(user)
