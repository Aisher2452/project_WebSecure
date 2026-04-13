from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import (
    ChatListItemResponse,
    ChatParticipantInfo,
    DirectChatCreateRequest,
    DirectChatResponse,
)
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.post("/direct", response_model=DirectChatResponse, status_code=201)
async def create_or_get_direct_chat(
    payload: DirectChatCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ChatService(db)
    chat = await service.create_or_get_direct_chat(current_user, payload.other_user_id)

    participants = [
        ChatParticipantInfo(
            id=participant.user.id,
            username=participant.user.username,
            email=participant.user.email,
            public_key=participant.user.public_key,
        )
        for participant in chat.participants
    ]

    return DirectChatResponse(
        chat_id=chat.id,
        created_at=chat.created_at,
        participants=participants,
    )


@router.get("", response_model=list[ChatListItemResponse])
async def list_my_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = ChatService(db)
    rows = await service.list_my_chats(current_user)

    return [
        ChatListItemResponse(
            chat_id=row.chat_id,
            created_at=row.chat_created_at,
            other_user=ChatParticipantInfo(
                id=row.other_user_id,
                username=row.other_username,
                email=row.other_email,
                public_key=row.other_public_key,
            ),
            last_message_id=row.last_message_id,
            last_message_preview=row.last_message_preview,
            last_message_created_at=row.last_message_created_at,
        )
        for row in rows
    ]