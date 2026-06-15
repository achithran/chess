"""Shared FastAPI dependencies: auth, rate limiting, plan checks."""
from __future__ import annotations

from datetime import date

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.redis import redis_client
from app.db.session import get_db
from app.models.user import SubscriptionPlan, User
from app.repositories.user_repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False
)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token, expected_type="access")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    user = await UserRepository(db).get(int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising 401."""
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type="access")
        user = await UserRepository(db).get(int(payload["sub"]))
        return user if user and user.is_active else None
    except Exception:
        return None


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def enforce_daily_analysis_quota(
    user: User | None = Depends(get_optional_user),
) -> User | None:
    """Quota gate for move analysis.

    - Anonymous users: allowed through (global slowapi rate limiter applies).
    - Authenticated free-plan users: capped at FREE_PLAN_DAILY_ANALYSES / day.
    - Pro users: unlimited.
    """
    if user is None:
        return None
    if user.plan == SubscriptionPlan.PRO:
        return user

    key = f"quota:analysis:{user.id}:{date.today().isoformat()}"
    try:
        used = await redis_client.incr(key)
        if used == 1:
            await redis_client.expire(key, 60 * 60 * 24)
    except Exception:
        return user

    if used > settings.FREE_PLAN_DAILY_ANALYSES:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                "ദിവസേനയുള്ള സൗജന്യ വിശകലന പരിധി കഴിഞ്ഞു. "
                "Pro പ്ലാനിലേക്ക് അപ്ഗ്രേഡ് ചെയ്യുക."
            ),
        )
    return user
