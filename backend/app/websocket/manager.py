from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.chat_connections: dict[int, dict[int, set[WebSocket]]] = defaultdict(
            lambda: defaultdict(set)
        )

    async def connect(self, chat_id: int, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.chat_connections[chat_id][user_id].add(websocket)

    def disconnect(self, chat_id: int, user_id: int, websocket: WebSocket) -> None:
        user_connections = self.chat_connections.get(chat_id, {}).get(user_id)
        if user_connections and websocket in user_connections:
            user_connections.remove(websocket)

        if user_connections is not None and len(user_connections) == 0:
            self.chat_connections[chat_id].pop(user_id, None)

        if chat_id in self.chat_connections and len(self.chat_connections[chat_id]) == 0:
            self.chat_connections.pop(chat_id, None)

    async def send_to_user_in_chat(
        self,
        chat_id: int,
        user_id: int,
        event: str,
        data: dict[str, Any],
    ) -> None:
        sockets = self.chat_connections.get(chat_id, {}).get(user_id, set()).copy()
        broken = []

        for ws in sockets:
            try:
                await ws.send_json({"event": event, "data": data})
            except Exception:
                broken.append(ws)

        for ws in broken:
            self.disconnect(chat_id, user_id, ws)

    async def broadcast_to_chat(
        self,
        chat_id: int,
        event: str,
        data: dict[str, Any],
    ) -> None:
        users = self.chat_connections.get(chat_id, {}).copy()
        for user_id in users.keys():
            await self.send_to_user_in_chat(chat_id, user_id, event, data)

    async def broadcast_to_chat_except_sender(
        self,
        chat_id: int,
        sender_user_id: int,
        event: str,
        data: dict[str, Any],
    ) -> None:
        users = self.chat_connections.get(chat_id, {}).copy()
        for user_id in users.keys():
            if user_id == sender_user_id:
                continue
            await self.send_to_user_in_chat(chat_id, user_id, event, data)

    def is_user_online_in_chat(self, chat_id: int, user_id: int) -> bool:
        sockets = self.chat_connections.get(chat_id, {}).get(user_id, set())
        return len(sockets) > 0

    def get_online_user_ids_in_chat(self, chat_id: int) -> list[int]:
        return [
            user_id
            for user_id, sockets in self.chat_connections.get(chat_id, {}).items()
            if len(sockets) > 0
        ]


manager = ConnectionManager()