"""Chat list, filters, unread counters and direct-chat behaviour."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Chat, ChatMember, Message

BASE_TIME = datetime(2026, 10, 19, 9, 0, tzinfo=UTC)


def _make_direct_chat(db: Session, first: Any, second: Any) -> Chat:
    chat = Chat(kind="direct", created_by=first.user.id)
    db.add(chat)
    db.flush()
    db.add_all(
        [
            ChatMember(chat_id=chat.id, user_id=first.user.id, role="member"),
            ChatMember(chat_id=chat.id, user_id=second.user.id, role="member"),
        ]
    )
    db.commit()
    return chat


def _make_group(db: Session, owner: Any, *members: Any, name: str = "Team") -> Chat:
    chat = Chat(kind="group", name=name, created_by=owner.user.id)
    db.add(chat)
    db.flush()
    db.add(ChatMember(chat_id=chat.id, user_id=owner.user.id, role="admin"))
    for member in members:
        db.add(ChatMember(chat_id=chat.id, user_id=member.user.id, role="member"))
    db.commit()
    return chat


def _add_message(
    db: Session,
    chat: Chat,
    sender: Any | None,
    text: str,
    created_at: datetime | None = None,
) -> Message:
    message = Message(
        chat_id=chat.id,
        sender_id=sender.user.id if sender is not None else None,
        kind="text" if sender is not None else "system",
        text=text,
        created_at=created_at or datetime.now(UTC),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def _chat_ids(response) -> set[str]:
    assert response.status_code == 200, response.text
    return {item["id"] for item in response.json()}


def test_list_returns_only_the_callers_chats(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    other = user_factory(display_name="Other")
    outsider = user_factory(display_name="Outsider")

    direct = _make_direct_chat(db_session, owner, other)
    group = _make_group(db_session, owner, other, name="Projektteam")
    _make_direct_chat(db_session, outsider, other)

    token_client = auth_client(owner)
    response = token_client.get("/api/chats")
    assert response.status_code == 200, response.text
    items = {item["id"]: item for item in response.json()}

    assert set(items) == {str(direct.id), str(group.id)}
    assert items[str(direct.id)]["title"] == "Other"
    assert items[str(direct.id)]["kind"] == "direct"
    assert items[str(direct.id)]["member_count"] == 2
    assert items[str(group.id)]["title"] == "Projektteam"
    assert items[str(group.id)]["role"] == "admin"
    assert items[str(group.id)]["member_count"] == 2
    assert items[str(direct.id)]["last_message"] is None
    assert items[str(direct.id)]["last_activity_at"] is not None


def test_filters_return_the_matching_subsets(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    other = user_factory(display_name="Other")

    direct = _make_direct_chat(db_session, owner, other)
    group = _make_group(db_session, owner, other, name="Projektteam")

    _add_message(db_session, direct, other, "Hallo aus dem Direktchat", BASE_TIME)
    _add_message(db_session, group, owner, "Hallo aus der Gruppe", BASE_TIME + timedelta(minutes=1))

    token_client = auth_client(owner)

    assert _chat_ids(token_client.get("/api/chats?filter=all")) == {
        str(direct.id),
        str(group.id),
    }
    assert _chat_ids(token_client.get("/api/chats?filter=groups")) == {str(group.id)}
    assert _chat_ids(token_client.get("/api/chats?filter=direct")) == {str(direct.id)}

    unread = _chat_ids(token_client.get("/api/chats?filter=unread"))
    assert unread == {str(direct.id)}
    assert group.id != direct.id


def test_list_is_ordered_by_newest_activity(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    other = user_factory(display_name="Other")

    older = _make_group(db_session, owner, other, name="Aeltere Gruppe")
    newer = _make_direct_chat(db_session, owner, other)

    _add_message(db_session, older, other, "zuerst", BASE_TIME)
    _add_message(db_session, newer, other, "danach", BASE_TIME + timedelta(hours=1))

    response = auth_client(owner).get("/api/chats")
    assert response.status_code == 200, response.text
    ids = [item["id"] for item in response.json()]
    assert ids == [str(newer.id), str(older.id)]

    last = response.json()[0]["last_message"]
    assert last["text"] == "danach"
    assert last["sender_display_name"] == "Other"
    assert last["created_at"].startswith("2026-10-19T10:00")


def test_search_narrows_by_chat_title_and_direct_name(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    alice = user_factory(display_name="Alice Meyer")
    bob = user_factory(display_name="Bob Schulz")

    direct = _make_direct_chat(db_session, owner, alice)
    group = _make_group(db_session, owner, bob, name="Projekt Phoenix")

    token_client = auth_client(owner)
    assert _chat_ids(token_client.get("/api/chats?search=alice")) == {str(direct.id)}
    assert _chat_ids(token_client.get("/api/chats?search=projekt")) == {str(group.id)}
    assert _chat_ids(token_client.get("/api/chats?search=nobody")) == set()
    assert _chat_ids(token_client.get("/api/chats?filter=direct&search=alice")) == {str(direct.id)}


def test_unread_counter_grows_and_drops_after_read_row_is_advanced(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    other = user_factory(display_name="Other")
    chat = _make_direct_chat(db_session, owner, other)

    first = _add_message(db_session, chat, other, "eins", BASE_TIME)
    second = _add_message(db_session, chat, other, "zwei", BASE_TIME + timedelta(minutes=1))

    token_client = auth_client(owner)
    payload = token_client.get("/api/chats").json()
    assert payload[0]["unread_count"] == 2

    membership = db_session.get(ChatMember, (chat.id, owner.user.id))
    assert membership is not None
    membership.last_read_message_id = second.id
    db_session.commit()

    payload = token_client.get("/api/chats").json()
    assert payload[0]["unread_count"] == 0

    _add_message(db_session, chat, other, "drei", BASE_TIME + timedelta(minutes=2))
    payload = token_client.get("/api/chats").json()
    assert payload[0]["unread_count"] == 1

    assert first.id < second.id


def test_own_messages_do_not_count_as_unread(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    other = user_factory(display_name="Other")
    chat = _make_direct_chat(db_session, owner, other)

    _add_message(db_session, chat, owner, "meine Nachricht", BASE_TIME)
    _add_message(db_session, chat, other, "fremde Nachricht", BASE_TIME + timedelta(minutes=1))

    payload = auth_client(owner).get("/api/chats").json()
    assert payload[0]["unread_count"] == 1


def test_group_detail_lists_every_member_with_role(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Zoe Admin")
    ben = user_factory(display_name="Ben Member")
    clara = user_factory(display_name="Amy Member")
    group = _make_group(db_session, owner, ben, clara, name="Projektteam")

    response = auth_client(owner).get(f"/api/chats/{group.id}")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["member_count"] == 3
    assert [entry["user"]["display_name"] for entry in payload["members"]] == [
        "Amy Member",
        "Ben Member",
        "Zoe Admin",
    ]
    roles = {entry["user"]["display_name"]: entry["role"] for entry in payload["members"]}
    assert roles == {"Amy Member": "member", "Ben Member": "member", "Zoe Admin": "admin"}
    for entry in payload["members"]:
        assert entry["user"]["id"]
        assert "avatar_url" in entry["user"]


def test_direct_chat_detail_returns_no_member_list(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    other = user_factory(display_name="Other")
    chat = _make_direct_chat(db_session, owner, other)

    response = auth_client(owner).get(f"/api/chats/{chat.id}")
    assert response.status_code == 200, response.text
    assert response.json()["members"] == []
    assert response.json()["member_count"] == 2


def test_non_member_gets_404_for_a_foreign_chat(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    owner = user_factory(display_name="Owner")
    other = user_factory(display_name="Other")
    outsider = user_factory(display_name="Outsider")
    chat = _make_direct_chat(db_session, owner, other)

    response = auth_client(outsider).get(f"/api/chats/{chat.id}")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "chat_not_found"
    assert error["title_de"]


def test_unknown_chat_id_gets_404(user_factory, auth_client) -> None:
    owner = user_factory(display_name="Owner")
    response = auth_client(owner).get(f"/api/chats/{uuid.uuid4()}")
    assert response.status_code == 404


def test_direct_chat_is_created_once_and_reused(
    db_session: Session,
    user_factory,
    auth_client,
) -> None:
    first = user_factory(display_name="First")
    second = user_factory(display_name="Second")

    first_client = auth_client(first)
    created = first_client.post("/api/chats/direct", json={"user_id": str(second.user.id)})
    assert created.status_code == 200, created.text
    chat_id = created.json()["id"]
    assert created.json()["kind"] == "direct"
    assert created.json()["title"] == "Second"
    assert created.json()["member_count"] == 2

    again = first_client.post("/api/chats/direct", json={"user_id": str(second.user.id)})
    assert again.status_code == 200, again.text
    assert again.json()["id"] == chat_id

    reverse = auth_client(second).post("/api/chats/direct", json={"user_id": str(first.user.id)})
    assert reverse.status_code == 200, reverse.text
    assert reverse.json()["id"] == chat_id
    assert reverse.json()["title"] == "First"

    assert _chat_ids(first_client.get("/api/chats")) == {chat_id}
    assert _chat_ids(auth_client(second).get("/api/chats")) == {chat_id}


def test_direct_chat_with_self_is_rejected(user_factory, auth_client) -> None:
    owner = user_factory(display_name="Owner")
    response = auth_client(owner).post("/api/chats/direct", json={"user_id": str(owner.user.id)})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_request"


def test_direct_chat_with_unknown_user_is_rejected(user_factory, auth_client) -> None:
    owner = user_factory(display_name="Owner")
    response = auth_client(owner).post("/api/chats/direct", json={"user_id": str(uuid.uuid4())})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "user_not_found"


def test_chat_routes_require_a_token(client: TestClient) -> None:
    assert client.get("/api/chats").status_code == 401
    assert client.post("/api/chats/direct", json={"user_id": str(uuid.uuid4())}).status_code == 401
    assert client.get(f"/api/chats/{uuid.uuid4()}").status_code == 401
