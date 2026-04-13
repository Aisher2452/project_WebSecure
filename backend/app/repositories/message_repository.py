from datetime import datetime, timezone

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import MessageStatusEnum, MessageTypeEnum
from app.models.message import Message


class MessageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_chat_messages(self, chat_id: int, limit: int = 100, offset: int = 0) -> list[Message]:
        now = datetime.now(timezone.utc)

        stmt = (
            select(Message)
            .options(selectinload(Message.sender))
            .where(
                Message.chat_id == chat_id,
                Message.is_expired.is_(False),
                or_(
                    Message.expires_at.is_(None),
                    Message.expires_at > now,
                ),
            )
            .order_by(Message.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_text_message(
        self,
        chat_id: int,
        sender_id: int,
        ciphertext: str,
        encrypted_key: str,
        iv: str,
        expiration_type,
        expires_at,
    ) -> Message:
        message = Message(
            chat_id=chat_id,
            sender_id=sender_id,
            message_type=MessageTypeEnum.TEXT,
            status=MessageStatusEnum.SENT,
            ciphertext=ciphertext,
            encrypted_key=encrypted_key,
            iv=iv,
            expiration_type=expiration_type,
            expires_at=expires_at,
            is_expired=False,
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return await self.get_by_id(message.id)

    async def create_file_message(
        self,
        chat_id: int,
        sender_id: int,
        encrypted_key: str,
        iv: str,
        file_name: str,
        file_size: int,
        mime_type: str | None,
        file_path: str,
        expiration_type,
        expires_at,
    ) -> Message:
        message = Message(
            chat_id=chat_id,
            sender_id=sender_id,
            message_type=MessageTypeEnum.FILE,
            status=MessageStatusEnum.SENT,
            encrypted_key=encrypted_key,
            iv=iv,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            file_path=file_path,
            expiration_type=expiration_type,
            expires_at=expires_at,
            is_expired=False,
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return await self.get_by_id(message.id)

    async def get_by_id(self, message_id: int) -> Message | None:
        stmt = (
            select(Message)
            .options(selectinload(Message.sender))
            .where(Message.id == message_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_delivered(self, message_id: int) -> None:
        stmt = (
            update(Message)
            .where(
                Message.id == message_id,
                Message.status == MessageStatusEnum.SENT,
            )
            .values(
                status=MessageStatusEnum.DELIVERED,
                delivered_at=datetime.now(timezone.utc),
            )
        )
        await self.db.execute(stmt)

    async def mark_read(self, message_id: int) -> None:
        stmt = (
            update(Message)
            .where(
                Message.id == message_id,
                Message.status.in_([MessageStatusEnum.SENT, MessageStatusEnum.DELIVERED]),
            )
            .values(
                status=MessageStatusEnum.READ,
                read_at=datetime.now(timezone.utc),
            )
        )
        await self.db.execute(stmt)

    async def mark_chat_messages_delivered_for_user(
        self,
        chat_id: int,
        current_user_id: int,
    ) -> list[int]:
        stmt = (
            update(Message)
            .where(
                Message.chat_id == chat_id,
                Message.sender_id != current_user_id,
                Message.is_expired.is_(False),
                Message.status == MessageStatusEnum.SENT,
                or_(
                    Message.expires_at.is_(None),
                    Message.expires_at > datetime.now(timezone.utc),
                ),
            )
            .values(
                status=MessageStatusEnum.DELIVERED,
                delivered_at=datetime.now(timezone.utc),
            )
            .returning(Message.id)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_messages_read_for_user(
        self,
        chat_id: int,
        current_user_id: int,
        message_ids: list[int],
    ) -> list[int]:
        if not message_ids:
            return []

        stmt = (
            update(Message)
            .where(
                Message.chat_id == chat_id,
                Message.id.in_(message_ids),
                Message.sender_id != current_user_id,
                Message.is_expired.is_(False),
                Message.status.in_([MessageStatusEnum.SENT, MessageStatusEnum.DELIVERED]),
                or_(
                    Message.expires_at.is_(None),
                    Message.expires_at > datetime.now(timezone.utc),
                ),
            )
            .values(
                status=MessageStatusEnum.READ,
                read_at=datetime.now(timezone.utc),
            )
            .returning(Message.id)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def expire_due_messages(self) -> list[int]:
        now = datetime.now(timezone.utc)

        stmt = (
            update(Message)
            .where(
                Message.is_expired.is_(False),
                Message.expires_at.is_not(None),
                Message.expires_at <= now,
                Message.status != MessageStatusEnum.EXPIRED,
            )
            .values(
                is_expired=True,
                status=MessageStatusEnum.EXPIRED,
            )
            .returning(Message.id)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def expire_message_by_id(self, message_id: int) -> bool:
        stmt = (
            update(Message)
            .where(
                Message.id == message_id,
                Message.is_expired.is_(False),
                Message.expires_at.is_not(None),
                Message.expires_at <= datetime.now(timezone.utc),
            )
            .values(
                is_expired=True,
                status=MessageStatusEnum.EXPIRED,
            )
            .returning(Message.id)
        )
        result = await self.db.execute(stmt)
        updated_id = result.scalar_one_or_none()
        return updated_id is not None