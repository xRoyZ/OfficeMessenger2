"""Profile update, avatar upload, password change and account deletion."""

from __future__ import annotations

import io
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.datastructures import Headers, UploadFile

from app.config import get_settings
from app.models import Chat, ChatMember, File, Status, StatusView, User
from app.models import Session as SessionRow
from app.services.security import hash_token, issue_token, verify_password
from app.services.uploads import save_image

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 32
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 32


def _upload(data: bytes, content_type: str, filename: str) -> UploadFile:
    return UploadFile(
        io.BytesIO(data),
        size=len(data),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def _upload_avatar(
    api: TestClient,
    data: bytes = PNG_BYTES,
    content_type: str = "image/png",
    filename: str = "avatar.png",
):
    return api.post("/api/profile/avatar", files={"file": (filename, data, content_type)})


def _assert_uniform_error(response, status_code: int, code: str) -> None:
    assert response.status_code == status_code
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert {"code", "title_de", "message"} <= set(error)
    assert error["code"] == code
    assert error["title_de"] == error["message"]
    assert error["title_de"]


def test_update_profile_is_read_back(
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory(display_name="Alter Name", status_text="Alter Status")
    other_user = user_factory()
    api = auth_client(test_user)

    response = api.patch(
        "/api/profile",
        json={"display_name": "Neuer Name", "status_text": "Neuer Status"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(test_user.user.id)
    assert body["display_name"] == "Neuer Name"
    assert body["status_text"] == "Neuer Status"
    assert body["email"] == test_user.email
    assert body["avatar_url"] is None

    me = api.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["display_name"] == "Neuer Name"
    assert me.json()["status_text"] == "Neuer Status"

    other_view = auth_client(other_user).get(f"/api/users/{test_user.user.id}")
    assert other_view.status_code == 200
    assert other_view.json()["display_name"] == "Neuer Name"
    assert other_view.json()["status_text"] == "Neuer Status"

    db_session.expire_all()
    stored = db_session.get(User, test_user.user.id)
    assert stored is not None
    assert stored.display_name == "Neuer Name"
    assert stored.status_text == "Neuer Status"


def test_update_profile_keeps_absent_fields_and_can_clear_status(
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory(display_name="Bleibt", status_text="Bleibt auch")
    api = auth_client(test_user)

    untouched = api.patch("/api/profile", json={})
    assert untouched.status_code == 200
    assert untouched.json()["display_name"] == "Bleibt"
    assert untouched.json()["status_text"] == "Bleibt auch"

    cleared = api.patch("/api/profile", json={"status_text": None})
    assert cleared.status_code == 200
    assert cleared.json()["display_name"] == "Bleibt"
    assert cleared.json()["status_text"] is None

    db_session.expire_all()
    stored = db_session.get(User, test_user.user.id)
    assert stored is not None
    assert stored.status_text is None


@pytest.mark.parametrize(
    "payload",
    [
        {"display_name": ""},
        {"display_name": None},
        {"display_name": "x" * 81},
        {"status_text": "x" * 281},
    ],
)
def test_update_profile_validates_lengths(
    auth_client: Callable,
    user_factory: Callable,
    payload: dict[str, object],
) -> None:
    test_user = user_factory()

    response = auth_client(test_user).patch("/api/profile", json=payload)

    _assert_uniform_error(response, 422, "validation_error")


def test_avatar_upload_replaces_the_previous_image(
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory()
    api = auth_client(test_user)

    first = _upload_avatar(api)
    assert first.status_code == 200
    first_url = first.json()["avatar_url"]
    assert first_url is not None
    assert api.get(first_url).content == PNG_BYTES

    second = _upload_avatar(api, JPEG_BYTES, "image/jpeg", "neu.jpg")
    assert second.status_code == 200
    second_url = second.json()["avatar_url"]
    assert second_url is not None
    assert second_url != first_url
    assert api.get(second_url).content == JPEG_BYTES

    db_session.expire_all()
    stored = db_session.get(User, test_user.user.id)
    assert stored is not None
    assert stored.avatar_url == second_url
    assert str(stored.avatar_file_id) == second_url.rsplit("/", 1)[-1]


def test_rejected_avatar_keeps_the_old_image(
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory()
    api = auth_client(test_user)

    accepted = _upload_avatar(api)
    assert accepted.status_code == 200
    old_url = accepted.json()["avatar_url"]
    assert old_url is not None

    rejected = _upload_avatar(api, b"kein Bild", "text/plain", "notiz.txt")
    _assert_uniform_error(rejected, 400, "invalid_upload")

    profile = api.patch("/api/profile", json={})
    assert profile.status_code == 200
    assert profile.json()["avatar_url"] == old_url
    assert api.get(old_url).status_code == 200

    db_session.expire_all()
    stored = db_session.get(User, test_user.user.id)
    assert stored is not None
    assert stored.avatar_url == old_url


def test_wrong_current_password_is_rejected(
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory(password="AltPass123!")

    response = auth_client(test_user).post(
        "/api/profile/password",
        json={"current_password": "FalschPass123!", "new_password": "NeuPass123!"},
    )

    _assert_uniform_error(response, 400, "invalid_password")
    assert "Passwort" in response.json()["error"]["title_de"]

    db_session.expire_all()
    stored = db_session.get(User, test_user.user.id)
    assert stored is not None
    assert verify_password("AltPass123!", stored.password_hash)
    assert not verify_password("NeuPass123!", stored.password_hash)


def test_password_change_stores_new_hash_and_revokes_other_sessions(
    client: TestClient,
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory(password="AltPass123!")

    other_token = issue_token()
    db_session.add(
        SessionRow(
            user_id=test_user.user.id,
            token_hash=hash_token(other_token),
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
    )
    db_session.commit()

    api = auth_client(test_user)
    response = api.post(
        "/api/profile/password",
        json={"current_password": "AltPass123!", "new_password": "NeuPass123!"},
    )
    assert response.status_code == 204

    db_session.expire_all()
    stored = db_session.get(User, test_user.user.id)
    assert stored is not None
    assert verify_password("NeuPass123!", stored.password_hash)
    assert not verify_password("AltPass123!", stored.password_hash)

    revoked = client.get(
        f"/api/files/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    _assert_uniform_error(revoked, 401, "unauthorized")

    still_valid = api.patch("/api/profile", json={})
    assert still_valid.status_code == 200


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("PATCH", "/api/profile"),
        ("POST", "/api/profile/password"),
        ("POST", "/api/profile/avatar"),
        ("DELETE", "/api/profile"),
    ],
)
def test_profile_routes_require_a_token(
    client: TestClient,
    method: str,
    path: str,
) -> None:
    if path.endswith("/avatar"):
        response = client.request(
            method,
            path,
            files={"file": ("avatar.png", PNG_BYTES, "image/png")},
        )
    else:
        response = client.request(method, path, json={})

    _assert_uniform_error(response, 401, "unauthorized")


def test_delete_account_removes_account_sessions_files_statuses_and_memberships(
    client: TestClient,
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory(
        email=f"profile-{uuid.uuid4().hex[:10]}@example.com",
        display_name="Weg damit",
        status_text="Bald weg",
    )
    other_user = user_factory(email=f"other-{uuid.uuid4().hex[:10]}@example.com")
    api = auth_client(test_user)
    other_api = auth_client(other_user)

    avatar = _upload_avatar(api)
    assert avatar.status_code == 200
    avatar_url = avatar.json()["avatar_url"]
    assert avatar_url is not None
    avatar_id = uuid.UUID(avatar_url.rsplit("/", 1)[-1])
    db_session.expire_all()
    avatar_row = db_session.get(File, avatar_id)
    assert avatar_row is not None
    avatar_path = get_settings().upload_dir / avatar_row.storage_name
    assert avatar_path.is_file()

    status_file = save_image(
        _upload(PNG_BYTES, "image/png", "status.png"),
        "status",
        test_user.user,
        db_session,
    )
    status_path = get_settings().upload_dir / status_file.storage_name
    now = datetime.now(UTC)
    status_row = Status(
        user_id=test_user.user.id,
        file_id=status_file.id,
        created_at=now,
        expires_at=now + timedelta(hours=24),
    )
    db_session.add(status_row)
    db_session.flush()
    db_session.add(StatusView(status_id=status_row.id, user_id=other_user.user.id, viewed_at=now))

    chat = Chat(kind="group", name="Testgruppe", created_by=other_user.user.id)
    db_session.add(chat)
    db_session.flush()
    db_session.add(ChatMember(chat_id=chat.id, user_id=test_user.user.id, role="member"))
    db_session.commit()
    status_id = status_row.id

    response = api.delete("/api/profile")
    assert response.status_code == 204

    _assert_uniform_error(api.patch("/api/profile", json={}), 401, "unauthorized")
    _assert_uniform_error(api.get(avatar_url), 401, "unauthorized")

    db_session.expunge_all()
    assert db_session.get(User, test_user.user.id) is None
    assert db_session.scalar(select(File).where(File.owner_id == test_user.user.id)) is None
    assert db_session.scalar(select(Status).where(Status.user_id == test_user.user.id)) is None
    assert (
        db_session.scalar(select(SessionRow).where(SessionRow.user_id == test_user.user.id)) is None
    )
    assert (
        db_session.scalar(select(ChatMember).where(ChatMember.user_id == test_user.user.id)) is None
    )
    assert (
        db_session.scalar(select(StatusView).where(StatusView.user_id == test_user.user.id)) is None
    )
    assert db_session.scalar(select(StatusView).where(StatusView.status_id == status_id)) is None
    assert not avatar_path.exists()
    assert not status_path.exists()

    _assert_uniform_error(other_api.get(avatar_url), 404, "file_not_found")
    _assert_uniform_error(other_api.get(f"/api/files/{status_file.id}"), 404, "file_not_found")

    login = client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": test_user.password},
    )
    _assert_uniform_error(login, 401, "generic")
