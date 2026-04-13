from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active_except_user(self, current_user_id: int) -> list[User]:
        stmt = (
            select(User)
            .where(User.id != current_user_id, User.is_active.is_(True))
            .order_by(User.username.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        username: str,
        email: str,
        password_hash: str,
        public_key: str,
        encrypted_private_key: str,
        key_salt: str,
    ) -> User:
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            public_key=public_key,
            encrypted_private_key=encrypted_private_key,
            key_salt=key_salt,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user