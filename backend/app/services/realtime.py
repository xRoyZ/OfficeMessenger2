"""Live WebSocket fan-out.

The connection registry is declared here so the realtime ticket can fill it in
without changing the import surface other modules already use.
"""

from __future__ import annotations

import uuid

from fastapi import WebSocket

from app.schemas import WsEvent


class ConnectionManager:
    """Registry of open WebSocket connections per user."""

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        pass

    async def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        pass

    async def broadcast_to_users(self, user_ids: list[uuid.UUID], event: WsEvent) -> None:
        pass


manager = ConnectionManager()
