"""Tests for the user directory endpoints."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _assert_error_shape(response, code: str) -> None:
    assert response.headers.get("content-type", "").startswith("application/json")
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert error["code"] == code
    assert isinstance(error["title_de"], str) and error["title_de"]
    assert error["title_de"] == error["message"]


def test_list_contains_other_users_but_not_the_caller(user_factory, auth_client) -> None:
    caller = user_factory(display_name=f"Caller {uuid.uuid4().hex[:6]}")
    other = user_factory(display_name=f"Other {uuid.uuid4().hex[:6]}")

    response = auth_client(caller).get("/api/users")

    assert response.status_code == 200
    entries = response.json()
    ids = {entry["id"] for entry in entries}
    assert str(other.user.id) in ids
    assert str(caller.user.id) not in ids

    entry = next(item for item in entries if item["id"] == str(other.user.id))
    assert set(entry) == {"id", "display_name", "status_text", "avatar_url"}
    assert entry["display_name"] == other.display_name
    assert entry["avatar_url"] is None
    assert "email" not in entry


def test_search_filters_by_name_case_insensitively(user_factory, auth_client) -> None:
    suffix = uuid.uuid4().hex[:8]
    caller = user_factory(display_name=f"Owner {suffix}")
    alpha = user_factory(display_name=f"Alpha {suffix}")
    beta = user_factory(display_name=f"Beta {suffix}")

    response = auth_client(caller).get("/api/users", params={"search": f"aLpHa {suffix}"})

    assert response.status_code == 200
    ids = {entry["id"] for entry in response.json()}
    assert str(alpha.user.id) in ids
    assert str(beta.user.id) not in ids
    assert str(caller.user.id) not in ids


def test_search_matches_email_prefix_without_returning_it(user_factory, auth_client) -> None:
    suffix = uuid.uuid4().hex[:8]
    caller = user_factory(display_name=f"Owner {suffix}")
    target_email = f"prefix-{suffix}@example.test"
    target = user_factory(email=target_email, display_name=f"Person {uuid.uuid4().hex[:8]}")

    response = auth_client(caller).get("/api/users", params={"search": f"prefix-{suffix}"})

    assert response.status_code == 200
    entries = response.json()
    assert str(target.user.id) in {entry["id"] for entry in entries}
    assert all("email" not in entry for entry in entries)


def test_search_without_matches_returns_empty_list(user_factory, auth_client) -> None:
    caller = user_factory()
    response = auth_client(caller).get(
        "/api/users", params={"search": f"nobody-{uuid.uuid4().hex}"}
    )

    assert response.status_code == 200
    assert response.json() == []


def test_get_known_user_returns_user_out(user_factory, auth_client) -> None:
    caller = user_factory()
    other = user_factory(status_text="Im Büro")

    response = auth_client(caller).get(f"/api/users/{other.user.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(other.user.id)
    assert body["display_name"] == other.display_name
    assert body["status_text"] == "Im Büro"
    assert body["avatar_url"] is None
    assert "email" not in body


def test_unknown_user_returns_uniform_404(user_factory, auth_client) -> None:
    caller = user_factory()
    response = auth_client(caller).get(f"/api/users/{uuid.uuid4()}")

    assert response.status_code == 404
    _assert_error_shape(response, "user_not_found")


def test_list_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/users")

    assert response.status_code == 401
    _assert_error_shape(response, "unauthorized")


def test_get_user_without_token_returns_401(client: TestClient) -> None:
    response = client.get(f"/api/users/{uuid.uuid4()}")

    assert response.status_code == 401
    _assert_error_shape(response, "unauthorized")


def test_invalid_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/users", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401
    _assert_error_shape(response, "unauthorized")
