"""Message history, sending, read receipts and the WebSocket handshake."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

from app.models import Chat, ChatMember, Message
from app.models import Session as SessionRow
from app.services.realtime import manager
from app.services.security import hash_token, issue_token

pytestmark = pytest.mark.usefixtures("db_session")


def _wait_for_socket(user_id: uuid.UUID) -> None:
    """Wait until the server has registered the accepted socket for ``user_id``."""

    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        if manager._connections.get(user_id):
            return
        time.sleep(0.01)
    raise AssertionError("WebSocket connection was not registered in time")


def _make_chat(db: Session, user_ids: list[uuid.UUID], kind: str = "direct") -> Chat:
    chat = Chat(kind=kind, name="Team" if kind == "group" else None)
    db.add(chat)
    db.flush()
    for user_id in user_ids:
        db.add(ChatMember(chat_id=chat.id, user_id=user_id, role="member"))
    db.commit()
    db.refresh(chat)
    return chat


def _add_message(db: Session, chat: Chat, sender_id: uuid.UUID | None, text: str) -> Message:
    message = Message(chat_id=chat.id, sender_id=sender_id, kind="text", text=text)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def _ws_url(token: str | None) -> str:
    if token is None:
        return "/api/ws"
    return f"/api/ws?token={token}"


def test_history_pagination_newest_last_and_has_more(
    client: TestClient, user_factory, db_session: Session
) -> None:
    alice = user_factory(display_name="Alice")
    bob = user_factory(display_name="Bob")
    chat = _make_chat(db_session, [alice.user.id, bob.user.id])
    for index in range(5):
        _add_message(db_session, chat, alice.user.id, f"Nachricht {index}")

    first = client.get(
        f"/api/chats/{chat.id}/messages",
        params={"limit": 2},
        headers={"Authorization": f"Bearer {alice.token}"},
    )
    assert first.status_code == 200
    page = first.json()
    assert [item["text"] for item in page["items"]] == ["Nachricht 3", "Nachricht 4"]
    assert page["has_more"] is True

    older = client.get(
        f"/api/chats/{chat.id}/messages",
        params={"limit": 2, "before": page["items"][0]["id"]},
        headers={"Authorization": f"Bearer {alice.token}"},
    )
    assert older.status_code == 200
    older_page = older.json()
    assert [item["text"] for item in older_page["items"]] == ["Nachricht 1", "Nachricht 2"]
    assert older_page["has_more"] is True

    oldest = client.get(
        f"/api/chats/{chat.id}/messages",
        params={"limit": 2, "before": older_page["items"][0]["id"]},
        headers={"Authorization": f"Bearer {alice.token}"},
    )
    assert oldest.status_code == 200
    oldest_page = oldest.json()
    assert [item["text"] for item in oldest_page["items"]] == ["Nachricht 0"]
    assert oldest_page["has_more"] is False


def test_send_message_reaches_history_and_other_member_over_websocket(
    client: TestClient, user_factory, db_session: Session
) -> None:
    alice = user_factory(display_name="Alice")
    bob = user_factory(display_name="Bob")
    chat = _make_chat(db_session, [alice.user.id, bob.user.id])

    with client.websocket_connect(_ws_url(bob.token)) as socket:
        _wait_for_socket(bob.user.id)
        response = client.post(
            f"/api/chats/{chat.id}/messages",
            json={"text": "Hallo Bob"},
            headers={"Authorization": f"Bearer {alice.token}"},
        )
        assert response.status_code == 201
        sent = response.json()
        assert sent["text"] == "Hallo Bob"
        assert sent["sender"]["display_name"] == "Alice"
        assert sent["is_read"] is False

        event = socket.receive_json()
        assert event["type"] == "message:new"
        assert event["chat_id"] == str(chat.id)
        assert event["message"]["id"] == sent["id"]
        assert event["message"]["sender"]["display_name"] == "Alice"

    history = client.get(
        f"/api/chats/{chat.id}/messages",
        headers={"Authorization": f"Bearer {alice.token}"},
    )
    assert history.status_code == 200
    assert [item["id"] for item in history.json()["items"]] == [sent["id"]]


def test_marking_read_flips_is_read_and_emits_event(
    client: TestClient, user_factory, db_session: Session
) -> None:
    alice = user_factory(display_name="Alice")
    bob = user_factory(display_name="Bob")
    chat = _make_chat(db_session, [alice.user.id, bob.user.id])
    message = _add_message(db_session, chat, alice.user.id, "Bitte lesen")

    before = client.get(
        f"/api/chats/{chat.id}/messages",
        headers={"Authorization": f"Bearer {alice.token}"},
    )
    assert before.json()["items"][0]["is_read"] is False

    with client.websocket_connect(_ws_url(alice.token)) as socket:
        _wait_for_socket(alice.user.id)
        read = client.post(
            f"/api/chats/{chat.id}/read",
            json={"last_message_id": message.id},
            headers={"Authorization": f"Bearer {bob.token}"},
        )
        assert read.status_code == 204

        event = socket.receive_json()
        assert event["type"] == "message:read"
        assert event["chat_id"] == str(chat.id)
        assert event["last_read_message_id"] == message.id
        assert event["reader_id"] == str(bob.user.id)

    after = client.get(
        f"/api/chats/{chat.id}/messages",
        headers={"Authorization": f"Bearer {alice.token}"},
    )
    assert after.json()["items"][0]["is_read"] is True


def test_group_message_is_read_when_any_other_member_reads(
    client: TestClient, user_factory, db_session: Session
) -> None:
    alice = user_factory(display_name="Alice")
    bob = user_factory(display_name="Bob")
    clara = user_factory(display_name="Clara")
    chat = _make_chat(db_session, [alice.user.id, bob.user.id, clara.user.id], kind="group")
    message = _add_message(db_session, chat, alice.user.id, "Hallo Gruppe")

    read = client.post(
        f"/api/chats/{chat.id}/read",
        json={"last_message_id": message.id},
        headers={"Authorization": f"Bearer {clara.token}"},
    )
    assert read.status_code == 204

    response = client.get(
        f"/api/chats/{chat.id}/messages",
        headers={"Authorization": f"Bearer {alice.token}"},
    )
    assert response.status_code == 200
    assert response.json()["items"][0]["is_read"] is True


def test_non_member_cannot_read_send_or_mark_read(
    client: TestClient, user_factory, db_session: Session
) -> None:
    alice = user_factory(display_name="Alice")
    bob = user_factory(display_name="Bob")
    outsider = user_factory(display_name="Outsider")
    chat = _make_chat(db_session, [alice.user.id, bob.user.id])
    message = _add_message(db_session, chat, alice.user.id, "Geheim")

    headers = {"Authorization": f"Bearer {outsider.token}"}
    history = client.get(f"/api/chats/{chat.id}/messages", headers=headers)
    assert history.status_code == 404
    assert history.json()["error"]["code"] == "chat_not_found"

    sent = client.post(f"/api/chats/{chat.id}/messages", json={"text": "Hallo"}, headers=headers)
    assert sent.status_code == 404

    read = client.post(
        f"/api/chats/{chat.id}/read",
        json={"last_message_id": message.id},
        headers=headers,
    )
    assert read.status_code == 404


def test_read_rejects_message_from_another_chat(
    client: TestClient, user_factory, db_session: Session
) -> None:
    alice = user_factory(display_name="Alice")
    bob = user_factory(display_name="Bob")
    chat = _make_chat(db_session, [alice.user.id, bob.user.id])
    other_chat = _make_chat(db_session, [alice.user.id, bob.user.id])
    foreign_message = _add_message(db_session, other_chat, alice.user.id, "Anderswo")

    response = client.post(
        f"/api/chats/{chat.id}/read",
        json={"last_message_id": foreign_message.id},
        headers={"Authorization": f"Bearer {bob.token}"},
    )
    assert response.status_code == 404


@pytest.mark.parametrize("token", [None, "not-a-real-token"])
def test_websocket_refuses_absent_or_invalid_token(client: TestClient, token: str | None) -> None:
    with (
        client.websocket_connect(_ws_url(token)) as socket,
        pytest.raises(WebSocketDisconnect) as exc_info,
    ):
        socket.receive_text()
    assert exc_info.value.code == 4401


def test_websocket_refuses_expired_token(
    client: TestClient, user_factory, db_session: Session
) -> None:
    user = user_factory()
    expired = issue_token()
    db_session.add(
        SessionRow(
            user_id=user.user.id,
            token_hash=hash_token(expired),
            expires_at=datetime.now(UTC) - timedelta(minutes=5),
        )
    )
    db_session.commit()

    with (
        client.websocket_connect(_ws_url(expired)) as socket,
        pytest.raises(WebSocketDisconnect) as exc_info,
    ):
        socket.receive_text()
    assert exc_info.value.code == 4401


def test_websocket_refuses_revoked_token(
    client: TestClient, user_factory, db_session: Session
) -> None:
    user = user_factory()
    session_row = db_session.query(SessionRow).filter_by(user_id=user.user.id).one()
    session_row.revoked_at = datetime.now(UTC)
    db_session.commit()

    with (
        client.websocket_connect(_ws_url(user.token)) as socket,
        pytest.raises(WebSocketDisconnect) as exc_info,
    ):
        socket.receive_text()
    assert exc_info.value.code == 4401
