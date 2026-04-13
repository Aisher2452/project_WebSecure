def message_to_dict(message) -> dict:
    return {
        "id": message.id,
        "chat_id": message.chat_id,
        "sender": {
            "id": message.sender.id,
            "username": message.sender.username,
        },
        "message_type": message.message_type.value if hasattr(message.message_type, "value") else message.message_type,
        "status": message.status.value if hasattr(message.status, "value") else message.status,
        "ciphertext": message.ciphertext,
        "encrypted_key": message.encrypted_key,
        "iv": message.iv,
        "file_name": message.file_name,
        "file_size": message.file_size,
        "mime_type": message.mime_type,
        "file_path": message.file_path,
        "expiration_type": (
            message.expiration_type.value
            if hasattr(message.expiration_type, "value")
            else message.expiration_type
        ),
        "expires_at": message.expires_at.isoformat() if message.expires_at else None,
        "is_expired": message.is_expired,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "delivered_at": message.delivered_at.isoformat() if message.delivered_at else None,
        "read_at": message.read_at.isoformat() if message.read_at else None,
    }