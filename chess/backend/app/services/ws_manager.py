"""WebSocket connection manager with Redis Pub/Sub broadcast.

Architecture:
  - Each live game has a Redis channel  ``game:{game_id}``
  - Each tournament has a channel       ``tournament:{tournament_id}``
  - When a player makes a move the server:
      1. Validates and persists the move.
      2. Publishes a JSON message to the game channel.
      3. All WebSocket connections subscribed to that channel receive it.

The manager holds a local dict of  connection_id → WebSocket  so it can
target individual sockets, and a dict of  channel → {connection_ids}  for
broadcast.  Redis Pub/Sub handles cross-process fan-out when running multiple
backend replicas.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # channel_name → set of connected WebSockets
        self._channels: dict[str, set[WebSocket]] = defaultdict(set)
        # WebSocket → set of channels it is subscribed to
        self._subscriptions: dict[WebSocket, set[str]] = defaultdict(set)
        # Redis listener tasks  channel → Task
        self._listener_tasks: dict[str, asyncio.Task] = {}

    # ── Connection lifecycle ──────────────────────────────────────────────────

    async def connect(self, ws: WebSocket, channel: str) -> None:
        await ws.accept()
        self._channels[channel].add(ws)
        self._subscriptions[ws].add(channel)
        await self._ensure_listener(channel)

    def disconnect(self, ws: WebSocket) -> None:
        for channel in list(self._subscriptions.get(ws, [])):
            self._channels[channel].discard(ws)
            if not self._channels[channel]:
                del self._channels[channel]
                task = self._listener_tasks.pop(channel, None)
                if task:
                    task.cancel()
        self._subscriptions.pop(ws, None)

    # ── Publishing ────────────────────────────────────────────────────────────

    async def publish(self, channel: str, data: dict[str, Any]) -> None:
        """Publish a message to all listeners on ``channel`` via Redis."""
        try:
            from app.db.redis import redis_client
            await redis_client.publish(channel, json.dumps(data))
        except Exception as exc:
            logger.warning("ws.publish_failed", extra={"channel": channel, "error": str(exc)})
            # Fallback: broadcast directly to local connections.
            await self._broadcast_local(channel, data)

    async def send_personal(self, ws: WebSocket, data: dict[str, Any]) -> None:
        try:
            await ws.send_json(data)
        except Exception:
            self.disconnect(ws)

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _broadcast_local(self, channel: str, data: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._channels.get(channel, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def _ensure_listener(self, channel: str) -> None:
        if channel in self._listener_tasks:
            return
        task = asyncio.create_task(self._redis_listener(channel))
        self._listener_tasks[channel] = task

    async def _redis_listener(self, channel: str) -> None:
        try:
            from app.db.redis import redis_client
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    continue
                await self._broadcast_local(channel, data)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning("ws.listener_error", extra={"channel": channel, "error": str(exc)})


# Singleton shared across the process.
ws_manager = ConnectionManager()


# ── Channel name helpers ──────────────────────────────────────────────────────

def game_channel(game_id: int) -> str:
    return f"game:{game_id}"


def tournament_channel(tournament_id: int) -> str:
    return f"tournament:{tournament_id}"
