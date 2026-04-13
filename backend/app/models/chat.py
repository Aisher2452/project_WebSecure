from datetime import datetime

from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Chat(Base):
    __tablename__ = "chats"
    __table_args__ = {"schema": "messenger"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    participants = relationship(
        "ChatParticipant",
        back_populates="chat",
        cascade="all, delete-orphan",
    )
    direct_pair = relationship(
        "DirectChatPair",
        back_populates="chat",
        uselist=False,
        cascade="all, delete-orphan",
    )
    messages = relationship(
        "Message",
        back_populates="chat",
        cascade="all, delete-orphan",
    )