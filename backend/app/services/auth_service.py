from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    get_refresh_token_expiry,
    hash_password,
    hash_refresh_token,
    verify_password,
)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.refresh_token_repo = RefreshTokenRepository(db)

    async def register(self, payload: RegisterRequest) -> TokenResponse:
        existing_email = await self.user_repo.get_by_email(payload.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        existing_username = await self.user_repo.get_by_username(payload.username)
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )

        password_hash = hash_password(payload.password)

        user = await self.user_repo.create(
            username=payload.username,
            email=payload.email,
            password_hash=password_hash,
            public_key=payload.public_key,
            encrypted_private_key=payload.encrypted_private_key,
            key_salt=payload.key_salt,
        )

        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token()

        await self.refresh_token_repo.create(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=get_refresh_token_expiry(),
        )

        await self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def login(self, payload: LoginRequest) -> TokenResponse:
        user = await self.user_repo.get_by_email(payload.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is inactive",
            )

        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token()

        await self.refresh_token_repo.create(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=get_refresh_token_expiry(),
        )

        await self.db.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def refresh(self, refresh_token: str) -> TokenResponse:
        token_hash = hash_refresh_token(refresh_token)

        stored_token = await self.refresh_token_repo.get_valid_by_hash(token_hash)
        if not stored_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        user = await self.user_repo.get_by_id(stored_token.user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        await self.refresh_token_repo.revoke_by_id(stored_token.id)

        new_access_token = create_access_token(user.id)
        new_refresh_token = create_refresh_token()

        await self.refresh_token_repo.create(
            user_id=user.id,
            token_hash=hash_refresh_token(new_refresh_token),
            expires_at=get_refresh_token_expiry(),
        )

        await self.db.commit()

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
        )