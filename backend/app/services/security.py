"""Password hashing and opaque session token helpers."""

from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plain-text password with Argon2id."""

    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Return whether ``password`` matches the stored Argon2 hash."""

    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def issue_token() -> str:
    """Create an opaque bearer token; only its hash is stored server-side."""

    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Return the stable SHA-256 hex digest used to look a token up."""

    return hashlib.sha256(token.encode("utf-8")).hexdigest()
