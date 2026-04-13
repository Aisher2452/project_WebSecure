from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class DirectChatPair(Base):
    __tablename__ = "direct_chat_pairs"
    __table_args__ = (
        CheckConstraint("user1_id <> user2_id", name="ck_direct_chat_pairs_not_same_users"),
        CheckConstraint("user1_id < user2_id", name="ck_direct_chat_pairs_user_order"),
        UniqueConstraint("user1_id", "user2_id", name="uq_direct_chat_pairs_users"),
        {"schema": "messenger"},
    )

    chat_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("messenger.chats.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user1_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("messenger.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    user2_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("messenger.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    chat = relationship("Chat", back_populates="direct_pair")