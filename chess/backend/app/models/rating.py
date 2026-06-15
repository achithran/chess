"""Rating history and leaderboard models."""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class RatingHistory(Base, PKMixin, TimestampMixin):
    __tablename__ = "rating_history"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(16), default="puzzle", nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)

    user: Mapped["User"] = relationship(back_populates="rating_history")


class LeaderboardEntry(Base, PKMixin, TimestampMixin):
    __tablename__ = "leaderboard_entries"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    scope: Mapped[str] = mapped_column(String(16), default="kerala", nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
