"""Live WebSocket fan-out.

A single :class:`ConnectionManager` keeps the open connections per user.  A
user may have more than one socket (several browser tabs); every one of them
receives the events addressed to that user.
"""

from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import WebSocket

from app.schemas import WsEvent

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Registry of open WebSocket connections per user."""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        """Register an already accepted socket for ``user_id``."""

        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        """Drop a socket; an unknown socket is ignored."""

        async with self._lock:
            sockets = self._connections.get(user_id)
            if sockets is None:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(user_id, None)

    async def broadcast_to_users(self, user_ids: list[uuid.UUID], event: WsEvent) -> None:
        """Send ``event`` to every socket of every listed user.

        A socket that fails to send is removed from the registry; a failure
        never propagates into the request that triggered the broadcast.
        """

        async with self._lock:
            targets = [
                (user_id, websocket)
                for user_id in set(user_ids)
                for websocket in self._connections.get(user_id, ())
            ]

        payload = event.model_dump(mode="json")
        for user_id, websocket in targets:
            try:
                await websocket.send_json(payload)
            except Exception:
                logger.debug("Dropping a closed WebSocket for user %s", user_id)
                await self.disconnect(user_id, websocket)


manager = ConnectionManager()
