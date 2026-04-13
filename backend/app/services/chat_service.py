from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.user_repository import UserRepository


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_repo = ChatRepository(db)
        self.user_repo = UserRepository(db)

    async def create_or_get_direct_chat(self, current_user: User, other_user_id: int):
        if current_user.id == other_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create chat with yourself",
            )

        other_user = await self.user_repo.get_by_id(other_user_id)
        if not other_user or not other_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Other user not found",
            )

        existing_chat = await self.chat_repo.get_direct_chat_between_users(
            current_user.id,
            other_user_id,
        )
        if existing_chat:
            return existing_chat

        chat = await self.chat_repo.create_direct_chat(
            current_user.id,
            other_user_id,
        )
        await self.db.commit()
        return chat

    async def list_my_chats(self, current_user: User):
        return await self.chat_repo.list_user_direct_chats(current_user.id)