"""Tests for registration, login, logout and server-side session revocation."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Session as SessionRow
from app.services.ratelimit import login_limiter, register_limiter
from app.services.security import hash_token

PASSWORD = "Demo1234!"


@pytest.fixture(autouse=True)
def _clear_rate_limits() -> Iterator[None]:
    login_limiter.clear()
    register_limiter.clear()
    yield
    login_limiter.clear()
    register_limiter.clear()


def _email() -> str:
    return f"auth-{uuid.uuid4().hex}@example.com"


def _register(
    client: TestClient,
    email: str | None = None,
    *,
    password: str = PASSWORD,
    display_name: str = "Alex Beispiel",
):
    return client.post(
        "/api/auth/register",
        json={
            "email": email or _email(),
            "display_name": display_name,
            "password": password,
        },
    )


def _assert_error(response, status_code: int, code: str) -> dict[str, str]:
    assert response.status_code == status_code
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert error["code"] == code
    assert isinstance(error["title_de"], str) and error["title_de"]
    assert error["title_de"] == error["message"]
    return error


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_creates_user_and_returns_usable_token(
    client: TestClient, db_session: Session
) -> None:
    email = _email()

    response = _register(
        client,
        f"  {email.upper()}  ",
        display_name="Alex Beispiel",
    )

    assert response.status_code == 201
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == email
    assert data["user"]["display_name"] == "Alex Beispiel"
    assert data["user"]["status_text"] is None
    assert data["user"]["avatar_url"] is None

    me = client.get("/api/auth/me", headers=_bearer(data["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["id"] == data["user"]["id"]

    session_row = db_session.scalar(
        select(SessionRow).where(SessionRow.token_hash == hash_token(data["access_token"]))
    )
    assert session_row is not None
    assert session_row.token_hash != data["access_token"]
    assert session_row.revoked_at is None


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    email = _email()
    first = _register(client, email)
    assert first.status_code == 201

    duplicate = _register(client, f"  {email.upper()}  ")

    error = _assert_error(duplicate, 409, "email_taken")
    assert "E-Mail" in error["title_de"]


def test_register_validation_error_uses_uniform_body(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "display_name": "", "password": "short"},
    )

    _assert_error(response, 422, "validation_error")


def test_login_returns_a_working_token(client: TestClient) -> None:
    email = _email()
    assert _register(client, email).status_code == 201

    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email

    me = client.get("/api/auth/me", headers=_bearer(data["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_login_unknown_email_and_wrong_password_share_one_generic_error(
    client: TestClient,
) -> None:
    email = _email()
    assert _register(client, email).status_code == 201

    wrong_password = client.post(
        "/api/auth/login", json={"email": email, "password": "Wrong-Passwort!"}
    )
    unknown_email = client.post("/api/auth/login", json={"email": _email(), "password": PASSWORD})

    first = _assert_error(wrong_password, 401, "generic")
    second = _assert_error(unknown_email, 401, "generic")
    assert first == second
    assert "E-Mail" in first["title_de"]
    assert "Passwort" in first["title_de"]


def test_logout_revokes_the_session_for_every_protected_route(
    client: TestClient, db_session: Session
) -> None:
    email = _email()
    registered = _register(client, email)
    assert registered.status_code == 201
    token = registered.json()["access_token"]

    assert client.get("/api/auth/me", headers=_bearer(token)).status_code == 200

    logout = client.post("/api/auth/logout", headers=_bearer(token))
    assert logout.status_code == 204

    session_row = db_session.scalar(
        select(SessionRow).where(SessionRow.token_hash == hash_token(token))
    )
    assert session_row is not None
    assert session_row.revoked_at is not None

    for path in ("/api/auth/me", "/api/users", "/api/chats"):
        response = client.get(path, headers=_bearer(token))
        _assert_error(response, 401, "unauthorized")


def test_logout_without_token_is_rejected_uniformly(client: TestClient) -> None:
    response = client.post("/api/auth/logout")

    _assert_error(response, 401, "unauthorized")


def test_login_rate_limit_after_ten_failed_attempts(client: TestClient) -> None:
    email = _email()

    for _ in range(10):
        response = client.post(
            "/api/auth/login", json={"email": email, "password": "Wrong-Passwort!"}
        )
        _assert_error(response, 401, "generic")

    limited = client.post("/api/auth/login", json={"email": email, "password": "Wrong-Passwort!"})

    _assert_error(limited, 429, "rate_limited")


def test_register_rate_limit_after_ten_failed_attempts(client: TestClient) -> None:
    email = _email()
    assert _register(client, email).status_code == 201

    for _ in range(10):
        response = _register(client, email)
        _assert_error(response, 409, "email_taken")

    limited = _register(client, email)

    _assert_error(limited, 429, "rate_limited")
