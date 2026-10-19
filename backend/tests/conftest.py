"""Shared pytest fixtures: isolated schema, HTTP clients and user factory."""

from __future__ import annotations

import os
import secrets
import tempfile
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

os.environ.setdefault("SECRET_KEY", secrets.token_hex(32))
os.environ.setdefault("CORS_ORIGIN", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp(prefix="messenger-uploads-"))

DATABASE_URL = (os.environ.get("DATABASE_URL") or "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL must point at the PostgreSQL database used by the tests. "
        "The product has no SQLite fallback."
    )


@dataclass
class TestUser:
    """A persisted user together with a valid, hashed-at-rest session token."""

    user: Any
    token: str
    email: str
    password: str
    display_name: str


@pytest.fixture(scope="session")
def test_schema() -> Iterator[str]:
    schema = f"test_{uuid.uuid4().hex[:12]}"
    admin_engine = create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT", poolclass=NullPool)
    with admin_engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    try:
        yield schema
    finally:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()


@pytest.fixture(scope="session")
def engine(test_schema: str) -> Iterator[Engine]:
    from app import models

    test_engine = create_engine(
        DATABASE_URL,
        connect_args={"options": f"-csearch_path={test_schema}"},
        poolclass=NullPool,
    )
    models.Base.metadata.create_all(test_engine)
    try:
        yield test_engine
    finally:
        test_engine.dispose()


@pytest.fixture(scope="session")
def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(scope="session")
def client(session_factory: sessionmaker[Session]) -> Iterator[TestClient]:
    from app.db import get_db
    from app.main import app

    def override_get_db() -> Iterator[Session]:
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def db_session(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def user_factory(db_session: Session) -> Callable[..., TestUser]:
    from app.config import get_settings
    from app.models import Session as SessionRow
    from app.models import User
    from app.services.security import hash_password, hash_token, issue_token

    ttl_hours = get_settings().token_ttl_hours

    def create(
        email: str | None = None,
        display_name: str | None = None,
        password: str = "Demo1234!",
        status_text: str | None = None,
    ) -> TestUser:
        resolved_email = email or f"user-{uuid.uuid4().hex[:10]}@example.test"
        resolved_name = display_name or "Test User"
        user = User(
            email=resolved_email,
            display_name=resolved_name,
            password_hash=hash_password(password),
            status_text=status_text,
        )
        db_session.add(user)
        db_session.flush()

        token = issue_token()
        db_session.add(
            SessionRow(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=datetime.now(UTC) + timedelta(hours=ttl_hours),
            )
        )
        db_session.commit()

        return TestUser(
            user=user,
            token=token,
            email=resolved_email,
            password=password,
            display_name=resolved_name,
        )

    return create


@pytest.fixture
def auth_client(client: TestClient) -> Callable[[TestUser], TestClient]:
    from app.main import app

    def make(test_user: TestUser) -> TestClient:
        return TestClient(
            app,
            headers={"Authorization": f"Bearer {test_user.token}"},
        )

    return make
