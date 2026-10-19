"""Idempotent demo seed for OfficeMessenger2.

Run it explicitly after the API has created the schema::

    python -m app.seed

The command fills an empty database with German demo content and exits without
changing anything when the demo accounts already exist.  It is never invoked
by the application startup path and never by the test suite on its own.
"""

from __future__ import annotations

import struct
import uuid
import zlib
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    Chat,
    ChatMember,
    File,
    Message,
    Status,
    StatusView,
    User,
)
from app.models import (
    Session as SessionRow,
)
from app.services.security import hash_password, hash_token, issue_token

DEMO_PASSWORD = "Demo1234!"
GROUP_NAME = "Projektteam"

DEMO_USERS: tuple[dict[str, object], ...] = (
    {
        "email": "anna@demo.local",
        "display_name": "Anna Schmidt",
        "status_text": "Im Meeting - Rückruf bitte später",
        "color": (214, 96, 82),
    },
    {
        "email": "ben@demo.local",
        "display_name": "Ben Weber",
        "status_text": "Unterwegs zum Kunden",
        "color": (62, 120, 190),
    },
    {
        "email": "clara@demo.local",
        "display_name": "Clara Fischer",
        "status_text": "Heute im Homeoffice",
        "color": (74, 150, 110),
    },
    {
        "email": "david@demo.local",
        "display_name": "David Wagner",
        "status_text": "Kaffee holen - gleich zurück",
        "color": (168, 118, 72),
    },
    {
        "email": "emma@demo.local",
        "display_name": "Emma Becker",
        "status_text": "Neue Woche, neue Ideen",
        "color": (132, 92, 172),
    },
)

DEMO_EMAILS = tuple(str(entry["email"]) for entry in DEMO_USERS)

ANNA_BEN_LINES: tuple[tuple[str, str], ...] = (
    ("ben", "Guten Morgen Anna, hast du die Folien für das Kundengespräch schon fertig?"),
    ("anna", "Guten Morgen Ben! Ja, ich habe sie gestern Abend noch überarbeitet."),
    ("ben", "Super. Kannst du mir die aktuelle Version vor der Mittagspause schicken?"),
    ("anna", "Klar, ich lade sie gleich in den Projektordner hoch."),
    ("ben", "Danke dir. Ich schaue sie mir dann direkt an."),
    ("anna", "Achte bitte besonders auf die Folien 5 und 6, die sind neu."),
    ("ben", "Alles klar. Die Zahlen zum dritten Quartal stimmen noch, oder?"),
    ("anna", "Ja, ich habe sie mit dem Controlling abgestimmt."),
    ("ben", "Perfekt. Dann kann das Gespräch morgen um zehn starten."),
    ("anna", "Ich reserviere schon einmal den Besprechungsraum."),
    ("ben", "Sehr gut. Bis später im Büro!"),
    ("anna", "Bis später, einen guten Start in den Tag."),
)

CLARA_DAVID_LINES: tuple[tuple[str, str], ...] = (
    ("clara", "Hallo David, hast du die Zugangsdaten für das Testsystem parat?"),
    ("david", "Hi Clara, ja, ich schicke sie dir gleich über den internen Kanal."),
    ("clara", "Danke! Ich teste heute die neue Anmeldung."),
    ("david", "Melde dich bitte, wenn etwas nicht funktioniert."),
    ("clara", "Mach ich. Der erste Durchlauf sah schon gut aus."),
    ("david", "Das freut mich. Welche Browser hast du getestet?"),
    ("clara", "Bisher Chrome und Firefox, Safari nehme ich mir nachher vor."),
    ("david", "Perfekt, dann kann ich die Ergebnisse in das Protokoll eintragen."),
    ("clara", "Ich schicke dir eine kurze Zusammenfassung."),
    ("david", "Danke dir, das hilft dem ganzen Team."),
    ("clara", "Bis später im Daily."),
)

GROUP_LINES: tuple[tuple[str | None, str, str], ...] = (
    ("anna", "Willkommen im Projektteam! Hier sammeln wir alle Absprachen.", "text"),
    ("ben", "Danke Anna. Ich habe die Aufgabenliste schon vorbereitet.", "text"),
    (None, "Anna Schmidt hat Ben Weber zum Admin gemacht.", "system"),
    ("clara", "Ich übernehme die Tests für die neue Anmeldung.", "text"),
    ("david", "Und ich kümmere mich um die Dokumentation.", "text"),
    (None, "Anna Schmidt hat Emma Becker zur Gruppe hinzugefügt.", "system"),
    ("emma", "Hallo zusammen, ich freue mich auf die Zusammenarbeit!", "text"),
    ("anna", "Unser nächstes Abstimmungsmeeting ist am Freitag um zehn.", "text"),
    ("ben", "Notiert. Ich schicke vorher noch die Agenda herum.", "text"),
)

STATUS_CAPTIONS: tuple[tuple[str, str | None, tuple[int, int, int]], ...] = (
    ("anna@demo.local", "Frischer Kaffee vor dem ersten Meeting", (180, 96, 70)),
    ("ben@demo.local", "Unterwegs zum Kunden", (70, 110, 170)),
    ("clara@demo.local", None, (80, 150, 110)),
    ("david@demo.local", "Neuer Schreibtisch im Homeoffice", (150, 120, 80)),
    ("emma@demo.local", "Team-Lunch am Freitag", (130, 100, 170)),
)

STATUS_VIEWERS: dict[str, tuple[str, ...]] = {
    "anna@demo.local": ("ben@demo.local", "clara@demo.local", "david@demo.local"),
    "ben@demo.local": ("anna@demo.local", "emma@demo.local"),
    "clara@demo.local": ("david@demo.local", "emma@demo.local"),
    "david@demo.local": ("anna@demo.local", "ben@demo.local", "clara@demo.local"),
    "emma@demo.local": ("anna@demo.local",),
}


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def _render_png(width: int, height: int, color: tuple[int, int, int]) -> bytes:
    """Render a small deterministic gradient image with a lighter centre."""

    base_r, base_g, base_b = color
    centre_x = width / 2
    centre_y = height / 2
    radius = min(width, height) * 0.36
    radius_sq = radius * radius
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        shade = 0.72 + 0.28 * (y / max(height - 1, 1))
        for x in range(width):
            inner = (x - centre_x) ** 2 + (y - centre_y) ** 2 <= radius_sq
            boost = 58 if inner else 0
            raw.extend(
                (
                    min(255, int(base_r * shade) + boost),
                    min(255, int(base_g * shade) + boost),
                    min(255, int(base_b * shade) + boost),
                )
            )
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", header)
        + _png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _png_chunk(b"IEND", b"")
    )


def _store_image(
    db: Session,
    upload_dir: Path,
    owner: User,
    kind: str,
    width: int,
    height: int,
    color: tuple[int, int, int],
) -> File:
    payload = _render_png(width, height, color)
    storage_name = f"{uuid.uuid4().hex}.png"
    (upload_dir / storage_name).write_bytes(payload)
    file_row = File(
        owner_id=owner.id,
        storage_name=storage_name,
        content_type="image/png",
        size=len(payload),
        kind=kind,
    )
    db.add(file_row)
    db.flush()
    return file_row


def _add_message(
    db: Session,
    chat: Chat,
    sender: User | None,
    text: str,
    created_at: datetime,
    kind: str = "text",
) -> Message:
    message = Message(
        chat_id=chat.id,
        sender_id=sender.id if sender is not None else None,
        kind=kind,
        text=text,
        created_at=created_at,
    )
    db.add(message)
    db.flush()
    return message


def _mark_read(db: Session, chat: Chat, reader: User, message: Message) -> None:
    membership = db.get(ChatMember, (chat.id, reader.id))
    if membership is not None:
        membership.last_read_message_id = message.id


def _create_users(
    db: Session,
    upload_dir: Path,
    now: datetime,
    token_ttl_hours: int,
) -> dict[str, User]:
    users: dict[str, User] = {}
    for entry in DEMO_USERS:
        user = User(
            email=str(entry["email"]),
            display_name=str(entry["display_name"]),
            password_hash=hash_password(DEMO_PASSWORD),
            status_text=str(entry["status_text"]),
        )
        db.add(user)
        db.flush()

        avatar = _store_image(
            db,
            upload_dir,
            user,
            "avatar",
            128,
            128,
            cast(tuple[int, int, int], entry["color"]),
        )
        user.avatar_file_id = avatar.id

        token = issue_token()
        db.add(
            SessionRow(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=now + timedelta(hours=token_ttl_hours),
            )
        )
        users[user.email] = user
        db.flush()
    return users


def _create_direct_chat(
    db: Session,
    starter: User,
    partner: User,
    lines: Sequence[tuple[str, str]],
    users: dict[str, User],
    created_at: datetime,
) -> None:
    chat = Chat(kind="direct", created_by=starter.id, created_at=created_at)
    db.add(chat)
    db.flush()
    db.add_all(
        [
            ChatMember(chat_id=chat.id, user_id=starter.id, role="member"),
            ChatMember(chat_id=chat.id, user_id=partner.id, role="member"),
        ]
    )
    db.flush()

    last: Message | None = None
    for position, (email, text) in enumerate(lines):
        last = _add_message(
            db,
            chat,
            users[f"{email}@demo.local"],
            text,
            created_at + timedelta(minutes=30 + position * 2),
        )
    if last is not None:
        _mark_read(db, chat, starter, last)
        _mark_read(db, chat, partner, last)


def _create_group(
    db: Session,
    upload_dir: Path,
    users: dict[str, User],
    now: datetime,
) -> None:
    anna = users["anna@demo.local"]
    created_at = now - timedelta(days=7)
    group = Chat(kind="group", name=GROUP_NAME, created_by=anna.id, created_at=created_at)
    db.add(group)
    db.flush()
    group_photo = _store_image(db, upload_dir, anna, "group", 320, 180, (54, 90, 150))
    group.photo_file_id = group_photo.id

    roles = (
        ("anna@demo.local", "admin"),
        ("ben@demo.local", "admin"),
        ("clara@demo.local", "member"),
        ("david@demo.local", "member"),
        ("emma@demo.local", "member"),
    )
    db.add_all(
        [ChatMember(chat_id=group.id, user_id=users[email].id, role=role) for email, role in roles]
    )
    db.flush()

    _add_message(
        db,
        group,
        None,
        f"Anna Schmidt hat die Gruppe „{GROUP_NAME}“ erstellt.",
        created_at,
        kind="system",
    )
    messages: list[Message] = []
    for position, (email, text, kind) in enumerate(GROUP_LINES):
        sender = users[f"{email}@demo.local"] if email is not None else None
        messages.append(
            _add_message(
                db,
                group,
                sender,
                text,
                now - timedelta(days=1, hours=2, minutes=40 - position * 3),
                kind=kind,
            )
        )
    if messages:
        for email in ("anna@demo.local", "ben@demo.local", "clara@demo.local"):
            _mark_read(db, group, users[email], messages[-1])


def _create_statuses(
    db: Session,
    upload_dir: Path,
    users: dict[str, User],
    now: datetime,
) -> None:
    statuses: dict[str, Status] = {}
    for index, (email, caption, color) in enumerate(STATUS_CAPTIONS):
        image = _store_image(db, upload_dir, users[email], "status", 360, 240, color)
        status = Status(
            user_id=users[email].id,
            file_id=image.id,
            caption=caption,
            created_at=now - timedelta(hours=index + 1),
            expires_at=now + timedelta(hours=23 - index),
        )
        db.add(status)
        db.flush()
        statuses[email] = status

    for email, viewer_emails in STATUS_VIEWERS.items():
        status = statuses[email]
        for offset, viewer_email in enumerate(viewer_emails):
            db.add(
                StatusView(
                    status_id=status.id,
                    user_id=users[viewer_email].id,
                    viewed_at=now - timedelta(minutes=20 + offset * 5),
                )
            )


def _populate(db: Session, upload_dir: Path, token_ttl_hours: int) -> None:
    now = datetime.now(UTC)
    upload_dir.mkdir(parents=True, exist_ok=True)
    users = _create_users(db, upload_dir, now, token_ttl_hours)
    _create_direct_chat(
        db,
        users["anna@demo.local"],
        users["ben@demo.local"],
        ANNA_BEN_LINES,
        users,
        now - timedelta(days=2, hours=6),
    )
    _create_direct_chat(
        db,
        users["clara@demo.local"],
        users["david@demo.local"],
        CLARA_DAVID_LINES,
        users,
        now - timedelta(days=1, hours=3),
    )
    _create_group(db, upload_dir, users, now)
    _create_statuses(db, upload_dir, users, now)


def seed(
    session_factory: sessionmaker[Session] | Callable[[], Session] | None = None,
    upload_dir: Path | None = None,
    token_ttl_hours: int | None = None,
) -> bool:
    """Populate an empty database with the demo content.

    Returns ``True`` when rows were created and ``False`` when the demo accounts
    already exist, in which case nothing is written.
    """

    if session_factory is None:
        from app.db import SessionLocal

        session_factory = SessionLocal
    if upload_dir is None or token_ttl_hours is None:
        from app.config import get_settings

        settings = get_settings()
        if upload_dir is None:
            upload_dir = settings.upload_dir
        if token_ttl_hours is None:
            token_ttl_hours = settings.token_ttl_hours

    db = session_factory()
    try:
        existing = db.scalar(select(User.id).where(User.email.in_(DEMO_EMAILS)).limit(1))
        if existing is not None:
            return False
        _populate(db, upload_dir, token_ttl_hours)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    """Entry point for ``python -m app.seed``."""

    created = seed()
    if created:
        print("Demo-Daten wurden angelegt.")
    else:
        print("Demo-Daten sind bereits vorhanden - nichts zu tun.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
