from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class WSBaseEvent(BaseModel):
    event: str
    data: dict[str, Any]


class WSMarkReadPayload(BaseModel):
    message_ids: list[int]


class WSNewMessageEvent(BaseModel):
    event: Literal["new_message"] = "new_message"
    data: dict[str, Any]


class WSMessageStatusUpdatedEvent(BaseModel):
    event: Literal["message_status_updated"] = "message_status_updated"
    data: dict[str, Any]


class WSMessagesDeliveredEvent(BaseModel):
    event: Literal["messages_delivered"] = "messages_delivered"
    data: dict[str, Any]


class WSNotificationEvent(BaseModel):
    event: Literal["notification"] = "notification"
    data: dict[str, Any]


class WSConnectedEvent(BaseModel):
    event: Literal["connected"] = "connected"
    data: dict[str, Any]


class WSMessageExpiredEvent(BaseModel):
    event: Literal["message_expired"] = "message_expired"
    data: dict[str, Any]


class WSNowIso(BaseModel):
    timestamp: datetime