from enum import Enum


class MessageTypeEnum(str, Enum):
    TEXT = "text"
    FILE = "file"


class MessageStatusEnum(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    EXPIRED = "expired"


class ExpirationTypeEnum(str, Enum):
    NONE = "none"
    ONE_DAY = "1_day"
    ONE_WEEK = "1_week"
    ONE_MONTH = "1_month"