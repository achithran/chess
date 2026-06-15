"""Data-access layer for users. Keeps SQL out of the service/route layers."""
from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuthProvider, User


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, user_id: int) -> User | None:
        return await self.db.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(
        self,
        email: str,
        hashed_password: str | None = None,
        full_name: str | None = None,
        provider: AuthProvider = AuthProvider.EMAIL,
        is_verified: bool = False,
    ) -> User:
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            auth_provider=provider,
            is_verified=is_verified,
            referral_code=secrets.token_urlsafe(6)[:8],
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def increment_puzzle_streak(self, user: User, solved: bool) -> None:
        user.puzzle_streak = user.puzzle_streak + 1 if solved else 0
        await self.db.flush()
