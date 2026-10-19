"""Skeleton guarantees: health, uniform errors, auth gate, CORS and the schema."""

from __future__ import annotations

import logging
import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

PROTECTED_ROUTES: list[tuple[str, str]] = [
    ("POST", "/api/auth/logout"),
    ("GET", "/api/auth/me"),
    ("GET", "/api/users"),
    ("GET", "/api/users/{user_id}"),
    ("PATCH", "/api/profile"),
    ("POST", "/api/profile/password"),
    ("POST", "/api/profile/avatar"),
    ("DELETE", "/api/profile"),
    ("GET", "/api/files/{file_id}"),
    ("GET", "/api/chats"),
    ("POST", "/api/chats/direct"),
    ("GET", "/api/chats/{chat_id}"),
    ("GET", "/api/chats/{chat_id}/messages"),
    ("POST", "/api/chats/{chat_id}/messages"),
    ("POST", "/api/chats/{chat_id}/read"),
    ("POST", "/api/groups"),
    ("PATCH", "/api/groups/{chat_id}"),
    ("POST", "/api/groups/{chat_id}/photo"),
    ("POST", "/api/groups/{chat_id}/members"),
    ("DELETE", "/api/groups/{chat_id}/members/{user_id}"),
    ("POST", "/api/groups/{chat_id}/admins"),
    ("DELETE", "/api/groups/{chat_id}/admins/{user_id}"),
    ("POST", "/api/groups/{chat_id}/leave"),
    ("GET", "/api/status"),
    ("POST", "/api/status"),
    ("POST", "/api/status/{status_id}/view"),
    ("GET", "/api/status/{status_id}/viewers"),
]

PUBLIC_ROUTES: list[tuple[str, str]] = [
    ("GET", "/api/health"),
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
]


def _path(template: str) -> str:
    return template.format(
        user_id=uuid.uuid4(),
        chat_id=uuid.uuid4(),
        file_id=uuid.uuid4(),
        status_id=uuid.uuid4(),
    )


def _assert_error_shape(response, code: str | None = None) -> None:
    assert response.headers.get("content-type", "").startswith("application/json")
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert {"code", "title_de", "message"} <= set(error)
    assert isinstance(error["code"], str) and error["code"]
    assert isinstance(error["title_de"], str) and error["title_de"]
    assert error["title_de"] == error["message"]
    if code is not None:
        assert error["code"] == code


def test_health_answers_without_token(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_route_rejects_missing_token(client: TestClient) -> None:
    response = client.get("/api/chats")
    assert response.status_code == 401
    _assert_error_shape(response, "unauthorized")


def test_protected_route_accepts_valid_token(
    client: TestClient,
    user_factory,
    auth_client,
) -> None:
    test_user = user_factory()
    response = auth_client(test_user).get("/api/chats")
    assert response.status_code not in (401, 404, 500)


def test_public_routes_are_reachable_without_token(client: TestClient) -> None:
    register = client.post(
        "/api/auth/register",
        json={
            "email": "new-user@example.test",
            "display_name": "Neue Person",
            "password": "Demo1234!",
        },
    )
    assert register.status_code not in (401, 404)
    assert register.status_code < 500

    login = client.post(
        "/api/auth/login",
        json={"email": "new-user@example.test", "password": "Demo1234!"},
    )
    assert login.status_code not in (401, 404)
    assert login.status_code < 500


def test_every_protected_route_rejects_missing_token(client: TestClient) -> None:
    failures: list[str] = []
    for method, template in PROTECTED_ROUTES:
        response = client.request(method, _path(template))
        if response.status_code != 401:
            failures.append(f"{method} {template} -> {response.status_code}")
            continue
        try:
            _assert_error_shape(response, "unauthorized")
        except AssertionError:
            failures.append(f"{method} {template} -> wrong error body")
    assert not failures, "routes not protected by the auth gate: " + ", ".join(failures)


def test_contract_routes_are_registered() -> None:
    from app.main import app

    registered = set()
    for path, operations in app.openapi()["paths"].items():
        for method in operations:
            registered.add((method.upper(), path))

    expected = set(PROTECTED_ROUTES) | set(PUBLIC_ROUTES)
    missing = sorted(expected - registered)
    assert not missing, f"contract routes missing from the app: {missing}"
    assert ("GET", "/api/chats/") not in registered
    assert ("GET", "/api/users/") not in registered


def test_error_bodies_share_one_shape(client: TestClient) -> None:
    unknown = client.get("/api/does-not-exist")
    assert unknown.status_code == 404
    _assert_error_shape(unknown, "not_found")

    invalid = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "display_name": "", "password": "x"},
    )
    assert invalid.status_code == 422
    _assert_error_shape(invalid, "validation_error")


def test_cors_names_only_the_configured_origin(client: TestClient) -> None:
    from app.config import get_settings

    origin = get_settings().cors_origin
    preflight = client.options(
        "/api/chats",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == origin
    assert preflight.headers["access-control-allow-credentials"] == "true"
    for name, value in preflight.headers.items():
        if name.lower().startswith("access-control-"):
            assert "*" not in value

    foreign = client.options(
        "/api/chats",
        headers={
            "Origin": "https://foreign.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in foreign.headers

    real = client.get("/api/health", headers={"Origin": origin})
    assert real.headers["access-control-allow-origin"] == origin
    assert real.headers["access-control-allow-credentials"] == "true"


def test_unexpected_error_uses_uniform_body_and_keeps_cors_headers() -> None:
    from app.config import get_settings
    from app.main import create_app

    boom_app = create_app()

    @boom_app.get("/api/boom")
    def boom() -> None:
        raise RuntimeError("boom")

    with TestClient(boom_app, raise_server_exceptions=False) as boom_client:
        response = boom_client.get("/api/boom", headers={"Origin": get_settings().cors_origin})

    assert response.status_code == 500
    _assert_error_shape(response, "internal_error")
    assert response.headers["access-control-allow-origin"] == get_settings().cors_origin


def test_websocket_rejects_missing_token(client: TestClient) -> None:
    with (
        client.websocket_connect("/api/ws") as websocket,
        pytest.raises(WebSocketDisconnect) as exc_info,
    ):
        websocket.receive_text()
    assert exc_info.value.code == 4401


def test_startup_applied_the_schema(client: TestClient) -> None:
    from sqlalchemy import inspect

    from app.db import engine

    tables = set(inspect(engine).get_table_names())
    expected = {
        "users",
        "sessions",
        "files",
        "chats",
        "chat_members",
        "messages",
        "statuses",
        "status_views",
        "alembic_version",
    }
    assert expected <= tables


def test_logs_do_not_contain_credentials_or_message_texts(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    email = "privacy-check@example.test"
    password = "S3cret-Passwort!"
    message_text = "Ein sehr vertraulicher Nachrichtentext"

    caplog.set_level(logging.DEBUG)
    client.post("/api/auth/login", json={"email": email, "password": password})
    client.post(
        f"/api/chats/{uuid.uuid4()}/messages",
        json={"text": message_text},
    )

    assert email not in caplog.text
    assert password not in caplog.text
    assert message_text not in caplog.text
