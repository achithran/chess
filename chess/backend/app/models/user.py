"""User and plan enums."""
from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.game import Game
    from app.models.subscription import Subscription
    from app.models.rating import RatingHistory


class SubscriptionPlan(str, enum.Enum):
    FREE = "free"
    PRO = "pro"


class AuthProvider(str, enum.Enum):
    EMAIL = "email"
    GOOGLE = "google"


class BeltLevel(str, enum.Enum):
    white = "white"
    yellow = "yellow"
    orange = "orange"
    green = "green"
    blue = "blue"
    brown = "brown"
    black = "black"


class SkillLevel(str, enum.Enum):
    zero = "zero"
    basics = "basics"
    intermediate = "intermediate"
    competitive = "competitive"


class User(Base, PKMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider), default=AuthProvider.EMAIL, nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_organiser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan), default=SubscriptionPlan.FREE, nullable=False
    )
    # Playing strength — Elo for tournaments, puzzle_rating for puzzles.
    rating: Mapped[int] = mapped_column(Integer, default=800, nullable=False)
    puzzle_rating: Mapped[int] = mapped_column(Integer, default=800, nullable=False)
    puzzle_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locale: Mapped[str] = mapped_column(String(8), default="ml", nullable=False)

    # ---- Chess Guru Mode: learning journey ----
    belt: Mapped[BeltLevel] = mapped_column(
        Enum(BeltLevel), default=BeltLevel.white, nullable=False
    )
    skill_level: Mapped[SkillLevel] = mapped_column(
        Enum(SkillLevel), default=SkillLevel.zero, nullable=False
    )
    xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lessons_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    daily_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_active_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Referral / coupon support
    referral_code: Mapped[str | None] = mapped_column(String(16), unique=True, nullable=True)
    referred_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    games: Mapped[list["Game"]] = relationship(back_populates="user")
    subscription: Mapped["Subscription | None"] = relationship(
        back_populates="user", uselist=False
    )
    rating_history: Mapped[list["RatingHistory"]] = relationship(back_populates="user")
