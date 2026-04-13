from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import ExpirationTypeEnum
from app.models.user import User
from app.schemas.message import (
    FileMessageCreateRequest,
    MessageListResponse,
    MessageResponse,
    MessageSenderInfo,
    TextMessageCreateRequest,
)
from app.services.message_service import MessageService
from app.websocket.manager import manager
from app.websocket.payloads import message_to_dict

router = APIRouter(prefix="/chats/{chat_id}/messages", tags=["Messages"])


def to_message_response(message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        chat_id=message.chat_id,
        sender=MessageSenderInfo(
            id=message.sender.id,
            username=message.sender.username,
        ),
        message_type=message.message_type,
        status=message.status,
        ciphertext=message.ciphertext,
        encrypted_key=message.encrypted_key,
        iv=message.iv,
        file_name=message.file_name,
        file_size=message.file_size,
        mime_type=message.mime_type,
        file_path=message.file_path,
        expiration_type=message.expiration_type,
        expires_at=message.expires_at,
        is_expired=message.is_expired,
        created_at=message.created_at,
        delivered_at=message.delivered_at,
        read_at=message.read_at,
    )


@router.get("", response_model=MessageListResponse)
async def get_chat_history(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MessageService(db)
    messages = await service.get_chat_history(current_user, chat_id)
    return MessageListResponse(items=[to_message_response(m) for m in messages])


@router.post("/text", response_model=MessageResponse, status_code=201)
async def send_text_message(
    chat_id: int,
    payload: TextMessageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MessageService(db)
    message = await service.send_text_message(current_user, chat_id, payload)

    await manager.broadcast_to_chat(
        chat_id=chat_id,
        event="new_message",
        data=message_to_dict(message),
    )

    return to_message_response(message)


@router.post("/file", response_model=MessageResponse, status_code=201)
async def send_file_message(
    chat_id: int,
    encrypted_key: str = Form(...),
    iv: str = Form(...),
    expiration_type: ExpirationTypeEnum = Form(ExpirationTypeEnum.NONE),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = MessageService(db)

    meta = FileMessageCreateRequest(
        encrypted_key=encrypted_key,
        iv=iv,
        expiration_type=expiration_type,
    )

    message = await service.send_file_message(
        current_user=current_user,
        chat_id=chat_id,
        meta=meta,
        file=file,
    )

    await manager.broadcast_to_chat(
        chat_id=chat_id,
        event="new_message",
        data=message_to_dict(message),
    )

    return to_message_response(message)