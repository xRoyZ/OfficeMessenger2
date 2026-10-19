"""Image statuses: posting, visibility, views and 24-hour expiry."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Status

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 32


def _post(
    client: TestClient,
    *,
    data: bytes = PNG_BYTES,
    content_type: str = "image/png",
    filename: str = "status.png",
    caption: str | None = None,
):
    payload = {"caption": caption} if caption is not None else {}
    return client.post(
        "/api/status",
        files={"file": (filename, data, content_type)},
        data=payload,
    )


def _group_for(response, user) -> dict | None:
    for group in response.json():
        if group["user"]["id"] == str(user.id):
            return group
    return None


def _assert_error(response, status_code: int, code: str) -> None:
    assert response.status_code == status_code
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert body["error"]["title_de"] == body["error"]["message"]
    assert body["error"]["title_de"]


def test_posted_status_is_readable_with_24_hour_expiry(
    auth_client: Callable,
    user_factory: Callable,
) -> None:
    author = user_factory()

    created = _post(auth_client(author), caption="Sommer im Büro")

    assert created.status_code == 201
    item = created.json()
    assert item["caption"] == "Sommer im Büro"
    assert item["image_url"].startswith("/api/files/")
    assert item["seen"] is False
    assert item["viewer_count"] == 0

    created_at = datetime.fromisoformat(item["created_at"])
    expires_at = datetime.fromisoformat(item["expires_at"])
    assert abs((expires_at - created_at).total_seconds() - 24 * 3600) < 1

    listed = auth_client(author).get("/api/status")
    assert listed.status_code == 200
    groups = listed.json()
    assert groups[0]["is_own"] is True
    assert groups[0]["user"]["id"] == str(author.user.id)

    own_group = _group_for(listed, author.user)
    assert own_group is not None
    assert own_group["is_own"] is True
    assert [entry["id"] for entry in own_group["items"]] == [item["id"]]
    assert own_group["items"][0]["image_url"] == item["image_url"]


def test_other_users_see_the_status_as_unseen(
    auth_client: Callable,
    user_factory: Callable,
) -> None:
    author = user_factory(display_name="Autorin")
    viewer = user_factory(display_name="Betrachter")

    created = _post(auth_client(author), caption="Neu")
    assert created.status_code == 201
    status_id = created.json()["id"]

    listed = auth_client(viewer).get("/api/status")
    assert listed.status_code == 200

    group = _group_for(listed, author.user)
    assert group is not None
    assert group["is_own"] is False
    assert group["has_unseen"] is True
    assert [entry["id"] for entry in group["items"]] == [status_id]
    assert group["items"][0]["seen"] is False
    assert group["items"][0]["viewer_count"] == 0


def test_viewing_marks_seen_and_fills_the_viewer_list_once(
    auth_client: Callable,
    user_factory: Callable,
) -> None:
    author = user_factory(display_name="Autorin")
    viewer = user_factory(display_name="Betrachter")

    created = _post(auth_client(author))
    assert created.status_code == 201
    status_id = created.json()["id"]

    viewer_client = auth_client(viewer)
    assert viewer_client.post(f"/api/status/{status_id}/view").status_code == 204
    assert viewer_client.post(f"/api/status/{status_id}/view").status_code == 204

    listed = viewer_client.get("/api/status")
    group = _group_for(listed, author.user)
    assert group is not None
    assert group["has_unseen"] is False
    assert group["items"][0]["seen"] is True
    assert group["items"][0]["viewer_count"] == 1

    author_listing = auth_client(author).get("/api/status")
    author_group = _group_for(author_listing, author.user)
    assert author_group is not None
    assert author_group["items"][0]["viewer_count"] == 1

    viewers = auth_client(author).get(f"/api/status/{status_id}/viewers")
    assert viewers.status_code == 200
    entries = viewers.json()
    assert len(entries) == 1
    assert entries[0]["user"]["id"] == str(viewer.user.id)
    assert entries[0]["user"]["display_name"] == "Betrachter"
    assert datetime.fromisoformat(entries[0]["viewed_at"]).tzinfo is not None


def test_foreign_viewers_request_is_forbidden(
    auth_client: Callable,
    user_factory: Callable,
) -> None:
    author = user_factory()
    stranger = user_factory()

    created = _post(auth_client(author))
    assert created.status_code == 201
    status_id = created.json()["id"]

    response = auth_client(stranger).get(f"/api/status/{status_id}/viewers")

    _assert_error(response, 403, "forbidden")


def test_unknown_status_answers_404(
    auth_client: Callable,
    user_factory: Callable,
) -> None:
    test_user = user_factory()
    missing = "00000000-0000-0000-0000-000000000000"

    _assert_error(
        auth_client(test_user).post(f"/api/status/{missing}/view"),
        404,
        "status_not_found",
    )
    _assert_error(
        auth_client(test_user).get(f"/api/status/{missing}/viewers"),
        404,
        "status_not_found",
    )


def test_expired_status_disappears_from_every_route(
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    author = user_factory()
    viewer = user_factory()

    created = _post(auth_client(author))
    assert created.status_code == 201
    status_id = created.json()["id"]

    assert auth_client(viewer).post(f"/api/status/{status_id}/view").status_code == 204

    status_row = db_session.get(Status, status_id)
    assert status_row is not None
    status_row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()

    listed = auth_client(viewer).get("/api/status")
    assert listed.status_code == 200
    assert all(entry["id"] != status_id for group in listed.json() for entry in group["items"])
    assert _group_for(listed, author.user) is None

    _assert_error(
        auth_client(viewer).post(f"/api/status/{status_id}/view"),
        404,
        "status_not_found",
    )
    _assert_error(
        auth_client(author).get(f"/api/status/{status_id}/viewers"),
        404,
        "status_not_found",
    )


def test_rejected_upload_leaves_no_status(
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory()

    response = _post(
        auth_client(test_user),
        data=b"kein Bild",
        content_type="text/plain",
        filename="notiz.txt",
    )

    _assert_error(response, 400, "invalid_upload")

    count = db_session.scalar(
        select(func.count()).select_from(Status).where(Status.user_id == test_user.user.id)
    )
    assert count == 0

    listed = auth_client(test_user).get("/api/status")
    assert listed.status_code == 200
    assert _group_for(listed, test_user.user) is None
