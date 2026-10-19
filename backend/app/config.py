"""Runtime configuration read from the process environment.

The values are read lazily through :func:`get_settings` so importing the
package never crashes before the process can log a readable message.  A
missing required value is reported with the name of the variable and a
pointer at ``RUN.json``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DEFAULT_CORS_ORIGIN = "http://localhost:5173"
DEFAULT_UPLOAD_DIR = "./uploads"
DEFAULT_MAX_UPLOAD_BYTES = 5_242_880
DEFAULT_TOKEN_TTL_HOURS = 720


class SettingsError(RuntimeError):
    """Raised when a required configuration value is missing or invalid."""


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origin: str
    secret_key: str
    upload_dir: Path
    max_upload_bytes: int
    token_ttl_hours: int


def _read_int(name: str, default: int | None) -> int:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        if default is None:
            raise SettingsError(
                f"{name} is required but is not set. Declare it in RUN.json or in the "
                "environment that starts the API."
            )
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise SettingsError(f"{name} must be an integer, got {raw!r}.") from exc
    if value <= 0:
        raise SettingsError(f"{name} must be greater than zero, got {value}.")
    return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the validated settings for this process.

    Raises :class:`SettingsError` naming the offending variable when the
    process cannot be configured correctly.
    """

    database_url = (os.environ.get("DATABASE_URL") or "").strip()
    if not database_url:
        raise SettingsError(
            "DATABASE_URL is required but is not set. Declare it in RUN.json "
            "(for example ${service:db.url}) or export it before starting the API."
        )

    secret_key = (os.environ.get("SECRET_KEY") or "").strip()
    if not secret_key:
        raise SettingsError(
            "SECRET_KEY is required but is not set. RUN.json generates it per run; "
            "for a local start export a random value before starting the API."
        )

    cors_origin = (os.environ.get("CORS_ORIGIN") or "").strip() or DEFAULT_CORS_ORIGIN
    if cors_origin == "*":
        raise SettingsError(
            "CORS_ORIGIN must name exactly one frontend origin; a wildcard is not allowed."
        )

    upload_dir = Path((os.environ.get("UPLOAD_DIR") or DEFAULT_UPLOAD_DIR).strip())

    return Settings(
        database_url=database_url,
        cors_origin=cors_origin,
        secret_key=secret_key,
        upload_dir=upload_dir,
        max_upload_bytes=_read_int("MAX_UPLOAD_BYTES", DEFAULT_MAX_UPLOAD_BYTES),
        token_ttl_hours=_read_int("TOKEN_TTL_HOURS", DEFAULT_TOKEN_TTL_HOURS),
    )
