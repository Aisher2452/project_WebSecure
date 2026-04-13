from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ExpirationTypeEnum, MessageStatusEnum, MessageTypeEnum


class TextMessageCreateRequest(BaseModel):
    ciphertext: str = Field(min_length=1)
    encrypted_key: str = Field(min_length=1)
    iv: str = Field(min_length=1)
    expiration_type: ExpirationTypeEnum = ExpirationTypeEnum.NONE


class FileMessageCreateRequest(BaseModel):
    encrypted_key: str = Field(min_length=1)
    iv: str = Field(min_length=1)
    expiration_type: ExpirationTypeEnum = ExpirationTypeEnum.NONE


class MessageSenderInfo(BaseModel):
    id: int
    username: str


class MessageResponse(BaseModel):
    id: int
    chat_id: int
    sender: MessageSenderInfo
    message_type: MessageTypeEnum
    status: MessageStatusEnum

    ciphertext: str | None = None
    encrypted_key: str
    iv: str

    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    file_path: str | None = None

    expiration_type: ExpirationTypeEnum
    expires_at: datetime | None = None
    is_expired: bool

    created_at: datetime
    delivered_at: datetime | None = None
    read_at: datetime | None = None


class MessageListResponse(BaseModel):
    items: list[MessageResponse]