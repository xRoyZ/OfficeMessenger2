"""Tests for the idempotent demo seed."""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app import models
from app.seed import DEMO_PASSWORD, DEMO_USERS, GROUP_NAME, seed
from app.services.security import verify_password


@pytest.fixture
def isolated_factory() -> Iterator[sessionmaker[Session]]:
    """Give the seed test a database schema no other test writes to."""

    database_url = os.environ["DATABASE_URL"]
    schema = f"test_seed_{uuid.uuid4().hex[:12]}"
    admin_engine: Engine = create_engine(
        database_url, isolation_level="AUTOCOMMIT", poolclass=NullPool
    )
    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))

    test_engine: Engine = create_engine(
        database_url,
        connect_args={"options": f"-csearch_path={schema}"},
        poolclass=NullPool,
    )
    models.Base.metadata.create_all(test_engine)
    factory = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)
    try:
        yield factory
    finally:
        test_engine.dispose()
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()


def _counts(db: Session) -> dict[str, int]:
    result: dict[str, int] = {}
    for name, table in models.Base.metadata.tables.items():
        result[name] = db.scalar(select(func.count()).select_from(table)) or 0
    return result


def test_seed_fills_an_empty_database_and_is_idempotent(
    isolated_factory: sessionmaker[Session],
    tmp_path: Path,
) -> None:
    upload_dir = tmp_path / "uploads"

    assert seed(isolated_factory, upload_dir, 720) is True

    with isolated_factory() as db:
        counts = _counts(db)
        assert all(count > 0 for count in counts.values()), counts
        assert counts["users"] == len(DEMO_USERS)

        users = db.scalars(select(models.User)).all()
        assert {user.email for user in users} == {entry["email"] for entry in DEMO_USERS}
        for user in users:
            assert user.avatar_file_id is not None
            assert user.status_text
            assert verify_password(DEMO_PASSWORD, user.password_hash)

        files = db.scalars(select(models.File)).all()
        assert files
        for file_row in files:
            assert (upload_dir / file_row.storage_name).is_file()

        direct_chats = db.scalars(select(models.Chat).where(models.Chat.kind == "direct")).all()
        assert len(direct_chats) == 2
        for chat in direct_chats:
            message_count = db.scalar(
                select(func.count())
                .select_from(models.Message)
                .where(models.Message.chat_id == chat.id)
            )
            assert message_count is not None and message_count >= 10
            read_marks = db.scalars(
                select(models.ChatMember).where(
                    models.ChatMember.chat_id == chat.id,
                    models.ChatMember.last_read_message_id.is_not(None),
                )
            ).all()
            assert len(read_marks) >= 1

        group = db.scalar(select(models.Chat).where(models.Chat.name == GROUP_NAME))
        assert group is not None and group.kind == "group"
        admins = db.scalars(
            select(models.ChatMember).where(
                models.ChatMember.chat_id == group.id,
                models.ChatMember.role == "admin",
            )
        ).all()
        members = db.scalars(
            select(models.ChatMember).where(models.ChatMember.chat_id == group.id)
        ).all()
        assert len(admins) == 2
        assert {db.get(models.User, admin.user_id).email for admin in admins} == {
            "anna@demo.local",
            "ben@demo.local",
        }
        assert len(members) == 5
        assert any(
            message.kind == "system"
            for message in db.scalars(
                select(models.Message).where(models.Message.chat_id == group.id)
            ).all()
        )

        live_statuses = db.scalars(
            select(models.Status).where(models.Status.expires_at > datetime.now(UTC))
        ).all()
        assert live_statuses
        status_ids = {status.id for status in live_statuses}
        views = db.scalars(
            select(models.StatusView).where(models.StatusView.status_id.in_(status_ids))
        ).all()
        assert views

    before = dict(counts)

    assert seed(isolated_factory, upload_dir, 720) is False

    with isolated_factory() as db:
        after = _counts(db)
    assert after == before
    assert sorted(path.name for path in upload_dir.iterdir()) == sorted(
        file_row.storage_name for file_row in files
    )
