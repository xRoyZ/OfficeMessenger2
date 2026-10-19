"""Image upload validation, storage and authenticated delivery."""

from __future__ import annotations

import io
import re
import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.datastructures import Headers, UploadFile

from app.config import get_settings
from app.errors import ApiError
from app.models import File
from app.services.uploads import save_image

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 32
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 32
WEBP_BYTES = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 32

ACCEPTED_IMAGES = [
    ("image/png", ".png", "urlaub.png", PNG_BYTES),
    ("image/jpeg", ".jpg", "urlaub.jpg", JPEG_BYTES),
    ("image/webp", ".webp", "urlaub.webp", WEBP_BYTES),
]


def _upload(data: bytes, content_type: str, filename: str) -> UploadFile:
    return UploadFile(
        io.BytesIO(data),
        size=len(data),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


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


@pytest.mark.parametrize(("content_type", "extension", "filename", "data"), ACCEPTED_IMAGES)
def test_accepted_image_is_stored_with_random_name_and_served(
    client: TestClient,
    auth_client: Callable,
    user_factory: Callable,
    db_session: Session,
    content_type: str,
    extension: str,
    filename: str,
    data: bytes,
) -> None:
    test_user = user_factory()

    record = save_image(
        _upload(data, content_type, filename),
        "avatar",
        test_user.user,
        db_session,
    )

    assert record.storage_name != filename
    assert re.fullmatch(r"[0-9a-f]{32}" + re.escape(extension), record.storage_name)
    assert "/" not in record.storage_name and ".." not in record.storage_name
    assert record.content_type == content_type
    assert record.size == len(data)
    assert record.kind == "avatar"
    assert (get_settings().upload_dir / record.storage_name).is_file()

    response = auth_client(test_user).get(f"/api/files/{record.id}")

    assert response.status_code == 200
    assert response.content == data
    assert response.headers["content-type"].startswith(content_type)
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize(
    ("content_type", "filename", "data"),
    [
        ("text/plain", "notiz.txt", b"nur ein Text"),
        ("image/png", "getarnt.png", b"definitiv kein Bild"),
        ("application/pdf", "dokument.pdf", b"%PDF-1.7 fake"),
    ],
)
def test_non_images_and_fake_extensions_are_rejected(
    user_factory: Callable,
    db_session: Session,
    content_type: str,
    filename: str,
    data: bytes,
) -> None:
    test_user = user_factory()

    with pytest.raises(ApiError) as exc_info:
        save_image(_upload(data, content_type, filename), "avatar", test_user.user, db_session)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "invalid_upload"


def test_declared_type_must_match_sniffed_type(
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory()

    with pytest.raises(ApiError) as exc_info:
        save_image(
            _upload(JPEG_BYTES, "image/png", "falsch.png"),
            "avatar",
            test_user.user,
            db_session,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "invalid_upload"


def test_save_image_enforces_limit_while_streaming(
    user_factory: Callable,
    db_session: Session,
) -> None:
    test_user = user_factory()
    limit = get_settings().max_upload_bytes
    oversized = PNG_BYTES + b"x" * (limit - len(PNG_BYTES) + 1)

    with pytest.raises(ApiError) as exc_info:
        save_image(
            _upload(oversized, "image/png", "zu-gross.png"),
            "avatar",
            test_user.user,
            db_session,
        )

    assert exc_info.value.status_code == 413
    assert exc_info.value.code == "payload_too_large"
    assert "zu groß" in exc_info.value.message

    stored = db_session.query(File).filter(File.owner_id == test_user.user.id).all()
    assert stored == []


def test_oversized_request_is_rejected_from_announced_size(
    client: TestClient,
    user_factory: Callable,
) -> None:
    test_user = user_factory()
    limit = get_settings().max_upload_bytes
    oversized = PNG_BYTES + b"x" * (limit - len(PNG_BYTES) + 1)

    response = client.post(
        "/api/profile/avatar",
        headers={"Authorization": f"Bearer {test_user.token}"},
        files={"file": ("zu-gross.png", oversized, "image/png")},
    )

    _assert_uniform_error(response, 413, "payload_too_large")
    assert "zu groß" in response.json()["error"]["title_de"]


def test_file_route_requires_a_token(client: TestClient) -> None:
    response = client.get(f"/api/files/{uuid.uuid4()}")

    _assert_uniform_error(response, 401, "unauthorized")


def test_unknown_file_answers_404(client: TestClient, user_factory: Callable) -> None:
    test_user = user_factory()

    response = client.get(
        f"/api/files/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {test_user.token}"},
    )

    _assert_uniform_error(response, 404, "file_not_found")
