import asyncio
import logging

from app.db.session import AsyncSessionLocal
from app.repositories.message_repository import MessageRepository
from app.services.expiration_service import ExpirationService
from app.websocket.manager import manager


logger = logging.getLogger(__name__)


async def expired_messages_worker(poll_interval_seconds: int = 10) -> None:
    while True:
        try:
            async with AsyncSessionLocal() as db:
                service = ExpirationService(db)
                expired_ids = await service.expire_due_messages()

                if expired_ids:
                    logger.info("Expired messages updated: %s", expired_ids)

                    repo = MessageRepository(db)
                    for message_id in expired_ids:
                        message = await repo.get_by_id(message_id)
                        if message:
                            await manager.broadcast_to_chat(
                                chat_id=message.chat_id,
                                event="message_expired",
                                data={
                                    "chat_id": message.chat_id,
                                    "message_id": message.id,
                                    "status": "expired",
                                },
                            )
        except Exception as exc:
            logger.exception("Expired messages worker error: %s", exc)

        await asyncio.sleep(poll_interval_seconds)