from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.chat_repository import ChatRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.user_repository import UserRepository
from app.utils.security import get_user_id_from_access_token


class WebSocketService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_repo = ChatRepository(db)
        self.user_repo = UserRepository(db)
        self.message_repo = MessageRepository(db)

    async def authenticate_ws_user(self, token: str):
        try:
            user_id = get_user_id_from_access_token(token)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
            )

        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        return user

    async def ensure_chat_access(self, chat_id: int, user_id: int):
        chat = await self.chat_repo.get_chat_for_user(chat_id, user_id)
        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found",
            )
        return chat

    async def mark_delivered_on_connect(self, chat_id: int, current_user_id: int) -> list[int]:
        updated_ids = await self.message_repo.mark_chat_messages_delivered_for_user(
            chat_id=chat_id,
            current_user_id=current_user_id,
        )
        await self.db.commit()
        return updated_ids

    async def mark_read(self, chat_id: int, current_user_id: int, message_ids: list[int]) -> list[int]:
        updated_ids = await self.message_repo.mark_messages_read_for_user(
            chat_id=chat_id,
            current_user_id=current_user_id,
            message_ids=message_ids,
        )
        await self.db.commit()
        return updated_ids