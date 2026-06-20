"""Authentication service: registration, login, token issuance/refresh."""
from __future__ import annotations

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import AuthProvider, User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenPair


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)

    async def register(
        self, email: str, password: str, full_name: str | None
    ) -> User:
        existing = await self.users.get_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        return await self.users.create(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
        )

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.users.get_by_email(email)
        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account disabled")
        return user

    async def login_with_google(self, email: str, full_name: str | None) -> User:
        """Upsert a user from a verified Google profile.

        NOTE: id_token verification happens in the route via Google's library;
        this method trusts an already-verified email.
        """
        user = await self.users.get_by_email(email)
        if user is None:
            user = await self.users.create(
                email=email,
                full_name=full_name,
                provider=AuthProvider.GOOGLE,
                is_verified=True,
            )
        return user

    def issue_tokens(self, user: User) -> TokenPair:
        return TokenPair(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
        )

    async def change_password(self, user: User, current_password: str, new_password: str) -> None:
        if not user.hashed_password:
            raise HTTPException(status_code=400, detail="OAuth accounts cannot change password here")
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.hashed_password = hash_password(new_password)
        self.db.add(user)
        await self.db.commit()

    async def update_profile(self, user: User, full_name: str | None) -> User:
        if full_name is not None:
            user.full_name = full_name
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user = await self.users.get(int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found")
        return self.issue_tokens(user)
