from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import MessageTypeEnum, MessageStatusEnum, ExpirationTypeEnum


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "(message_type != 'text') OR (ciphertext IS NOT NULL)",
            name="ck_messages_text_requires_ciphertext",
        ),
        CheckConstraint(
            "(message_type != 'file') OR (file_name IS NOT NULL AND file_path IS NOT NULL)",
            name="ck_messages_file_requires_metadata",
        ),
        {"schema": "messenger"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    chat_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("messenger.chats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("messenger.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_type: Mapped[MessageTypeEnum] = mapped_column(
        Enum(
            MessageTypeEnum,
            name="message_type_enum",
            schema="messenger",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    status: Mapped[MessageStatusEnum] = mapped_column(
        Enum(
            MessageStatusEnum,
            name="message_status_enum",
            schema="messenger",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=MessageStatusEnum.SENT,
        server_default=MessageStatusEnum.SENT.value,
    )

    ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    iv: Mapped[str] = mapped_column(Text, nullable=False)

    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    expiration_type: Mapped[ExpirationTypeEnum] = mapped_column(
        Enum(
            ExpirationTypeEnum,
            name="expiration_type_enum",
            schema="messenger",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ExpirationTypeEnum.NONE,
        server_default=ExpirationTypeEnum.NONE.value,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_expired: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")