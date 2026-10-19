"""Group creation, administration, membership rules and system messages."""

from __future__ import annotations

import io
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChatMember, Message

pytestmark = pytest.mark.usefixtures("db_session")

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 32


def _headers(test_user) -> dict[str, str]:
    return {"Authorization": f"Bearer {test_user.token}"}


def _create_group(client: TestClient, creator, members: list) -> dict:
    response = client.post(
        "/api/groups",
        json={
            "name": "Projektteam",
            "member_ids": [str(member.user.id) for member in members],
        },
        headers=_headers(creator),
    )
    assert response.status_code == 201, response.text
    return response.json()


def _membership(db: Session, chat_id, user_id) -> ChatMember | None:
    return db.get(ChatMember, (uuid.UUID(str(chat_id)), user_id))


def _system_texts(db: Session, chat_id) -> list[str]:
    rows = db.scalars(
        select(Message)
        .where(Message.chat_id == uuid.UUID(str(chat_id)), Message.kind == "system")
        .order_by(Message.id)
    ).all()
    return [row.text for row in rows]


def _role_of(chat: dict, user_id) -> str | None:
    """Return the role the response lists for ``user_id``, or None if absent."""

    for entry in chat["members"]:
        if entry["user"]["id"] == str(user_id):
            return entry["role"]
    return None


def test_creation_makes_creator_admin_and_lists_group_for_every_member(
    client: TestClient, user_factory, db_session: Session
) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    clara = user_factory(display_name="Clara")

    created = _create_group(client, anna, [ben, clara])

    assert created["kind"] == "group"
    assert created["title"] == "Projektteam"
    assert created["role"] == "admin"
    assert created["member_count"] == 3
    assert created["unread_count"] == 0
    assert created["photo_url"] is None

    creator_membership = _membership(db_session, created["id"], anna.user.id)
    assert creator_membership is not None
    assert creator_membership.role == "admin"
    for member in (ben, clara):
        membership = _membership(db_session, created["id"], member.user.id)
        assert membership is not None
        assert membership.role == "member"


def test_creation_needs_a_member_besides_the_creator(client: TestClient, user_factory) -> None:
    anna = user_factory(display_name="Anna")

    only_self = client.post(
        "/api/groups",
        json={"name": "Allein", "member_ids": [str(anna.user.id)]},
        headers=_headers(anna),
    )
    assert only_self.status_code == 400
    assert only_self.json()["error"]["code"] == "invalid_members"

    unknown = client.post(
        "/api/groups",
        json={"name": "Fremd", "member_ids": [str(uuid.uuid4())]},
        headers=_headers(anna),
    )
    assert unknown.status_code == 400
    assert unknown.json()["error"]["code"] == "invalid_members"


def test_plain_member_cannot_mutate_the_group(
    client: TestClient, user_factory, db_session: Session
) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    clara = user_factory(display_name="Clara")
    created = _create_group(client, anna, [ben])
    chat_id = created["id"]

    rename = client.patch(
        f"/api/groups/{chat_id}",
        json={"name": "Von Ben"},
        headers=_headers(ben),
    )
    assert rename.status_code == 403

    add = client.post(
        f"/api/groups/{chat_id}/members",
        json={"user_id": str(clara.user.id)},
        headers=_headers(ben),
    )
    assert add.status_code == 403

    remove = client.delete(
        f"/api/groups/{chat_id}/members/{anna.user.id}",
        headers=_headers(ben),
    )
    assert remove.status_code == 403

    promote = client.post(
        f"/api/groups/{chat_id}/admins",
        json={"user_id": str(ben.user.id)},
        headers=_headers(ben),
    )
    assert promote.status_code == 403

    photo = client.post(
        f"/api/groups/{chat_id}/photo",
        files={"file": ("gruppe.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=_headers(ben),
    )
    assert photo.status_code == 403


def test_creation_and_settings_responses_list_members_with_roles(
    client: TestClient, user_factory
) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    clara = user_factory(display_name="Clara")

    created = _create_group(client, anna, [ben, clara])
    chat_id = created["id"]
    assert _role_of(created, anna.user.id) == "admin"
    assert _role_of(created, ben.user.id) == "member"
    assert _role_of(created, clara.user.id) == "member"
    assert [entry["user"]["display_name"] for entry in created["members"]] == [
        "Anna",
        "Ben",
        "Clara",
    ]

    renamed = client.patch(
        f"/api/groups/{chat_id}",
        json={"name": "Neues Team"},
        headers=_headers(anna),
    )
    assert renamed.status_code == 200
    assert len(renamed.json()["members"]) == 3

    photo = client.post(
        f"/api/groups/{chat_id}/photo",
        files={"file": ("gruppe.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=_headers(anna),
    )
    assert photo.status_code == 200
    assert len(photo.json()["members"]) == 3


def test_admin_renames_and_changes_the_photo(client: TestClient, user_factory) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    created = _create_group(client, anna, [ben])
    chat_id = created["id"]

    renamed = client.patch(
        f"/api/groups/{chat_id}",
        json={"name": "Neues Team"},
        headers=_headers(anna),
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Neues Team"

    photo = client.post(
        f"/api/groups/{chat_id}/photo",
        files={"file": ("gruppe.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=_headers(anna),
    )
    assert photo.status_code == 200
    photo_url = photo.json()["photo_url"]
    assert photo_url is not None and photo_url.startswith("/api/files/")


def test_admin_adds_removes_and_promotes_members(
    client: TestClient, user_factory, db_session: Session
) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    clara = user_factory(display_name="Clara")
    david = user_factory(display_name="David")
    created = _create_group(client, anna, [ben])
    chat_id = created["id"]

    added = client.post(
        f"/api/groups/{chat_id}/members",
        json={"user_id": str(clara.user.id)},
        headers=_headers(anna),
    )
    assert added.status_code == 200
    assert added.json()["member_count"] == 3
    assert _role_of(added.json(), clara.user.id) == "member"

    promoted = client.post(
        f"/api/groups/{chat_id}/admins",
        json={"user_id": str(clara.user.id)},
        headers=_headers(anna),
    )
    assert promoted.status_code == 200
    assert _role_of(promoted.json(), clara.user.id) == "admin"
    assert _membership(db_session, chat_id, clara.user.id).role == "admin"

    demoted = client.delete(
        f"/api/groups/{chat_id}/admins/{clara.user.id}",
        headers=_headers(anna),
    )
    assert demoted.status_code == 200
    assert _role_of(demoted.json(), clara.user.id) == "member"
    assert _membership(db_session, chat_id, clara.user.id).role == "member"

    removed = client.delete(
        f"/api/groups/{chat_id}/members/{clara.user.id}",
        headers=_headers(anna),
    )
    assert removed.status_code == 200
    assert removed.json()["member_count"] == 2
    assert _role_of(removed.json(), clara.user.id) is None
    assert [entry["user"]["display_name"] for entry in removed.json()["members"]] == [
        "Anna",
        "Ben",
    ]
    assert _membership(db_session, chat_id, clara.user.id) is None

    missing = client.post(
        f"/api/groups/{chat_id}/members",
        json={"user_id": str(david.user.id)},
        headers=_headers(ben),
    )
    assert missing.status_code == 403


def test_system_messages_describe_every_administration_step(
    client: TestClient, user_factory, db_session: Session
) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    clara = user_factory(display_name="Clara")
    created = _create_group(client, anna, [ben])
    chat_id = created["id"]

    client.post(
        f"/api/groups/{chat_id}/members",
        json={"user_id": str(clara.user.id)},
        headers=_headers(anna),
    )
    client.post(
        f"/api/groups/{chat_id}/admins",
        json={"user_id": str(clara.user.id)},
        headers=_headers(anna),
    )
    client.delete(
        f"/api/groups/{chat_id}/admins/{clara.user.id}",
        headers=_headers(anna),
    )
    client.delete(
        f"/api/groups/{chat_id}/members/{ben.user.id}",
        headers=_headers(anna),
    )
    client.post(f"/api/groups/{chat_id}/leave", headers=_headers(clara))

    texts = _system_texts(db_session, chat_id)
    assert any(text == "Anna hat Clara zur Gruppe hinzugefügt" for text in texts)
    assert any(text == "Anna hat Clara zum Admin gemacht" for text in texts)
    assert any(text == "Anna hat Clara zum Mitglied gemacht" for text in texts)
    assert any(text == "Anna hat Ben aus der Gruppe entfernt" for text in texts)
    assert any(text == "Clara hat die Gruppe verlassen" for text in texts)

    system_rows = db_session.scalars(
        select(Message).where(Message.chat_id == uuid.UUID(str(chat_id)), Message.kind == "system")
    ).all()
    assert system_rows
    assert all(row.sender_id is None for row in system_rows)


def test_last_admin_cannot_leave_or_demote_itself(
    client: TestClient, user_factory, db_session: Session
) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    created = _create_group(client, anna, [ben])
    chat_id = created["id"]

    leave = client.post(f"/api/groups/{chat_id}/leave", headers=_headers(anna))
    assert leave.status_code == 400
    assert leave.json()["error"]["code"] == "last_admin"
    assert leave.json()["error"]["title_de"]

    demote = client.delete(
        f"/api/groups/{chat_id}/admins/{anna.user.id}",
        headers=_headers(anna),
    )
    assert demote.status_code == 400
    assert demote.json()["error"]["code"] == "last_admin"

    assert _membership(db_session, chat_id, anna.user.id).role == "admin"


def test_plain_member_can_leave_any_time(
    client: TestClient, user_factory, db_session: Session
) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    created = _create_group(client, anna, [ben])
    chat_id = created["id"]

    left = client.post(f"/api/groups/{chat_id}/leave", headers=_headers(ben))
    assert left.status_code == 204
    assert _membership(db_session, chat_id, ben.user.id) is None

    again = client.post(f"/api/groups/{chat_id}/leave", headers=_headers(ben))
    assert again.status_code == 404


def test_non_member_gets_404_instead_of_group_details(client: TestClient, user_factory) -> None:
    anna = user_factory(display_name="Anna")
    ben = user_factory(display_name="Ben")
    outsider = user_factory(display_name="Outsider")
    created = _create_group(client, anna, [ben])
    chat_id = created["id"]

    rename = client.patch(
        f"/api/groups/{chat_id}",
        json={"name": "Fremd"},
        headers=_headers(outsider),
    )
    assert rename.status_code == 404

    leave = client.post(f"/api/groups/{chat_id}/leave", headers=_headers(outsider))
    assert leave.status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/groups"),
        ("PATCH", "/api/groups/{chat_id}"),
        ("POST", "/api/groups/{chat_id}/photo"),
        ("POST", "/api/groups/{chat_id}/members"),
        ("DELETE", "/api/groups/{chat_id}/members/{user_id}"),
        ("POST", "/api/groups/{chat_id}/admins"),
        ("DELETE", "/api/groups/{chat_id}/admins/{user_id}"),
        ("POST", "/api/groups/{chat_id}/leave"),
    ],
)
def test_group_routes_require_a_token(client: TestClient, method: str, path: str) -> None:
    url = path.format(chat_id=uuid.uuid4(), user_id=uuid.uuid4())
    response = client.request(method, url)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"
