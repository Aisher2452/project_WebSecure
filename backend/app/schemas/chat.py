from datetime import datetime

from pydantic import BaseModel


class DirectChatCreateRequest(BaseModel):
    other_user_id: int


class ChatParticipantInfo(BaseModel):
    id: int
    username: str
    email: str
    public_key: str


class DirectChatResponse(BaseModel):
    chat_id: int
    created_at: datetime
    participants: list[ChatParticipantInfo]


class ChatListItemResponse(BaseModel):
    chat_id: int
    created_at: datetime
    other_user: ChatParticipantInfo
    last_message_id: int | None = None
    last_message_preview: str | None = None
    last_message_created_at: datetime | None = None