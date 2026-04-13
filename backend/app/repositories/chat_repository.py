from datetime import datetime, timezone

from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.models.chat import Chat
from app.models.chat_participant import ChatParticipant
from app.models.direct_chat_pair import DirectChatPair
from app.models.message import Message
from app.models.user import User


class ChatRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_direct_chat_between_users(self, user1_id: int, user2_id: int) -> Chat | None:
        left, right = sorted([user1_id, user2_id])

        stmt = (
            select(Chat)
            .join(DirectChatPair, DirectChatPair.chat_id == Chat.id)
            .options(
                selectinload(Chat.participants).selectinload(ChatParticipant.user),
                selectinload(Chat.direct_pair),
            )
            .where(
                DirectChatPair.user1_id == left,
                DirectChatPair.user2_id == right,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_direct_chat(self, user1_id: int, user2_id: int) -> Chat:
        left, right = sorted([user1_id, user2_id])

        chat = Chat()
        self.db.add(chat)
        await self.db.flush()

        pair = DirectChatPair(
            chat_id=chat.id,
            user1_id=left,
            user2_id=right,
        )
        self.db.add(pair)

        self.db.add(ChatParticipant(chat_id=chat.id, user_id=left))
        self.db.add(ChatParticipant(chat_id=chat.id, user_id=right))

        await self.db.flush()
        await self.db.refresh(chat)

        stmt = (
            select(Chat)
            .options(
                selectinload(Chat.participants).selectinload(ChatParticipant.user),
                selectinload(Chat.direct_pair),
            )
            .where(Chat.id == chat.id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def get_chat_for_user(self, chat_id: int, user_id: int) -> Chat | None:
        stmt = (
            select(Chat)
            .join(ChatParticipant, ChatParticipant.chat_id == Chat.id)
            .options(
                selectinload(Chat.participants).selectinload(ChatParticipant.user),
                selectinload(Chat.direct_pair),
            )
            .where(Chat.id == chat_id, ChatParticipant.user_id == user_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_user_direct_chats(self, user_id: int):
        now = datetime.now(timezone.utc)

        current_cp = aliased(ChatParticipant)
        other_cp = aliased(ChatParticipant)
        other_user = aliased(User)

        active_message_filter = and_(
            Message.is_expired.is_(False),
            or_(
                Message.expires_at.is_(None),
                Message.expires_at > now,
            ),
        )

        last_message_subquery = (
            select(
                Message.chat_id.label("chat_id"),
                func.max(Message.created_at).label("max_created_at"),
            )
            .where(active_message_filter)
            .group_by(Message.chat_id)
            .subquery()
        )

        last_message_join = aliased(Message)

        stmt = (
            select(
                Chat.id.label("chat_id"),
                Chat.created_at.label("chat_created_at"),
                other_user.id.label("other_user_id"),
                other_user.username.label("other_username"),
                other_user.email.label("other_email"),
                other_user.public_key.label("other_public_key"),
                last_message_join.id.label("last_message_id"),
                case(
                    (last_message_join.message_type == "text", last_message_join.ciphertext),
                    else_=last_message_join.file_name,
                ).label("last_message_preview"),
                last_message_join.created_at.label("last_message_created_at"),
            )
            .select_from(Chat)
            .join(current_cp, and_(current_cp.chat_id == Chat.id, current_cp.user_id == user_id))
            .join(other_cp, and_(other_cp.chat_id == Chat.id, other_cp.user_id != user_id))
            .join(other_user, other_user.id == other_cp.user_id)
            .join(DirectChatPair, DirectChatPair.chat_id == Chat.id)
            .outerjoin(
                last_message_subquery,
                last_message_subquery.c.chat_id == Chat.id,
            )
            .outerjoin(
                last_message_join,
                and_(
                    last_message_join.chat_id == Chat.id,
                    last_message_join.created_at == last_message_subquery.c.max_created_at,
                    last_message_join.is_expired.is_(False),
                    or_(
                        last_message_join.expires_at.is_(None),
                        last_message_join.expires_at > now,
                    ),
                ),
            )
            .order_by(desc(func.coalesce(last_message_join.created_at, Chat.created_at)))
        )

        result = await self.db.execute(stmt)
        return result.all()