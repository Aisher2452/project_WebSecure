from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.message_repository import MessageRepository


class ExpirationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.message_repo = MessageRepository(db)

    async def expire_due_messages(self) -> list[int]:
        expired_ids = await self.message_repo.expire_due_messages()
        if expired_ids:
            await self.db.commit()
        else:
            await self.db.rollback()
        return expired_ids