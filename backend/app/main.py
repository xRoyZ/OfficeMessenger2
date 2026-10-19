"""FastAPI application factory, middleware, migrations and routers."""

from __future__ import annotations

import logging
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from alembic import command
from app.config import Settings, get_settings
from app.errors import UnhandledErrorMiddleware, register_exception_handlers
from app.routers import auth, chats, files, groups, messages, profile, status, users
from app.services.uploads import UploadSizeLimitMiddleware

logger = logging.getLogger("app")

BASE_DIR = Path(__file__).resolve().parents[1]
MIGRATION_ATTEMPTS = 10
MIGRATION_DELAY_SECONDS = 1.0


def _run_migrations(settings: Settings) -> None:
    """Bring the schema to the latest revision, waiting briefly for PostgreSQL."""

    config = Config(str(BASE_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BASE_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.database_url)

    for attempt in range(1, MIGRATION_ATTEMPTS + 1):
        try:
            command.upgrade(config, "head")
            return
        except OperationalError:
            if attempt == MIGRATION_ATTEMPTS:
                raise
            logger.warning(
                "Database is not reachable yet (attempt %d/%d); retrying in %.1fs",
                attempt,
                MIGRATION_ATTEMPTS,
                MIGRATION_DELAY_SECONDS,
            )
            time.sleep(MIGRATION_DELAY_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    _run_migrations(settings)
    logger.info("OfficeMessenger2 API ready")
    yield


def create_app() -> FastAPI:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("uvicorn.access").disabled = True

    app = FastAPI(
        title="OfficeMessenger2 API",
        version="1.0.0",
        lifespan=lifespan,
    )

    settings = get_settings()

    app.add_middleware(UnhandledErrorMiddleware)
    app.add_middleware(UploadSizeLimitMiddleware, max_bytes=settings.max_upload_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )

    register_exception_handlers(app)

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(profile.router)
    app.include_router(files.router)
    app.include_router(chats.router)
    app.include_router(messages.router)
    app.include_router(groups.router)
    app.include_router(status.router)

    return app


app = create_app()
