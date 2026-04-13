from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.websocket import WSBaseEvent, WSMarkReadPayload
from app.services.websocket_service import WebSocketService
from app.websocket.manager import manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/chats/{chat_id}")
async def websocket_chat(
    websocket: WebSocket,
    chat_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    service = WebSocketService(db)

    try:
        user = await service.authenticate_ws_user(token)
        await service.ensure_chat_access(chat_id, user.id)
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(chat_id, user.id, websocket)

    try:
        delivered_ids = await service.mark_delivered_on_connect(chat_id, user.id)

        await websocket.send_json(
            {
                "event": "connected",
                "data": {
                    "chat_id": chat_id,
                    "user_id": user.id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }
        )

        if delivered_ids:
            await manager.broadcast_to_chat(
                chat_id=chat_id,
                event="messages_delivered",
                data={
                    "chat_id": chat_id,
                    "message_ids": delivered_ids,
                    "status": "delivered",
                    "updated_by_user_id": user.id,
                },
            )

        await manager.broadcast_to_chat_except_sender(
            chat_id=chat_id,
            sender_user_id=user.id,
            event="notification",
            data={
                "type": "user_joined_chat",
                "chat_id": chat_id,
                "user_id": user.id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        while True:
            raw_data = await websocket.receive_json()
            event = WSBaseEvent(**raw_data)

            if event.event == "ping":
                await websocket.send_json(
                    {
                        "event": "pong",
                        "data": {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                )
                continue

            if event.event == "mark_read":
                payload = WSMarkReadPayload(**event.data)
                updated_ids = await service.mark_read(
                    chat_id=chat_id,
                    current_user_id=user.id,
                    message_ids=payload.message_ids,
                )

                if updated_ids:
                    await manager.broadcast_to_chat(
                        chat_id=chat_id,
                        event="message_status_updated",
                        data={
                            "chat_id": chat_id,
                            "message_ids": updated_ids,
                            "status": "read",
                            "updated_by_user_id": user.id,
                        },
                    )
                continue

            await websocket.send_json(
                {
                    "event": "error",
                    "data": {
                        "message": f"Unsupported event: {event.event}",
                    },
                }
            )

    except WebSocketDisconnect:
        manager.disconnect(chat_id, user.id, websocket)
    except Exception:
        manager.disconnect(chat_id, user.id, websocket)
        await websocket.close(code=1011)