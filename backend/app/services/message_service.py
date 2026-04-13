import os
import uuid

import aiofiles
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.message_repository import MessageRepository
from app.schemas.message import FileMessageCreateRequest, TextMessageCreateRequest
from app.utils.messages import calculate_expires_at


class MessageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat_repo = ChatRepository(db)
        self.message_repo = MessageRepository(db)

    async def get_chat_history(self, current_user: User, chat_id: int):
        chat = await self.chat_repo.get_chat_for_user(chat_id, current_user.id)
        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found",
            )

        return await self.message_repo.list_chat_messages(chat_id)

    async def send_text_message(
        self,
        current_user: User,
        chat_id: int,
        payload: TextMessageCreateRequest,
    ):
        chat = await self.chat_repo.get_chat_for_user(chat_id, current_user.id)
        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found",
            )

        message = await self.message_repo.create_text_message(
            chat_id=chat_id,
            sender_id=current_user.id,
            ciphertext=payload.ciphertext,
            encrypted_key=payload.encrypted_key,
            iv=payload.iv,
            expiration_type=payload.expiration_type,
            expires_at=calculate_expires_at(payload.expiration_type),
        )
        await self.db.commit()
        return message

    async def send_file_message(
        self,
        current_user: User,
        chat_id: int,
        meta: FileMessageCreateRequest,
        file: UploadFile,
    ):
        chat = await self.chat_repo.get_chat_for_user(chat_id, current_user.id)
        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found",
            )

        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File name is required",
            )

        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

        ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        full_path = os.path.join(settings.UPLOAD_DIR, unique_name)

        size = 0
        async with aiofiles.open(full_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                await out_file.write(chunk)

        message = await self.message_repo.create_file_message(
            chat_id=chat_id,
            sender_id=current_user.id,
            encrypted_key=meta.encrypted_key,
            iv=meta.iv,
            file_name=file.filename,
            file_size=size,
            mime_type=file.content_type,
            file_path=full_path.replace("\\", "/"),
            expiration_type=meta.expiration_type,
            expires_at=calculate_expires_at(meta.expiration_type),
        )
        await self.db.commit()
        return message