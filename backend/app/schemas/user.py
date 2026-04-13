from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    public_key: str
    is_active: bool
    created_at: datetime