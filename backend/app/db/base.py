from app.db.base_class import Base

# Импортируем модели здесь только для Alembic/autogenerate
from app.models.user import User  # noqa: F401
from app.models.chat import Chat  # noqa: F401
from app.models.chat_participant import ChatParticipant  # noqa: F401
from app.models.direct_chat_pair import DirectChatPair  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401