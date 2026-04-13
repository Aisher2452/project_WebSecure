from datetime import datetime, timedelta, timezone

from app.models.enums import ExpirationTypeEnum


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def calculate_expires_at(expiration_type: ExpirationTypeEnum) -> datetime | None:
    now = utc_now()

    if expiration_type == ExpirationTypeEnum.NONE:
        return None
    if expiration_type == ExpirationTypeEnum.ONE_DAY:
        return now + timedelta(days=1)
    if expiration_type == ExpirationTypeEnum.ONE_WEEK:
        return now + timedelta(weeks=1)
    if expiration_type == ExpirationTypeEnum.ONE_MONTH:
        return now + timedelta(days=30)

    return None


def is_message_expired(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return False
    return expires_at <= utc_now()