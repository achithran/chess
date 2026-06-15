"""Tactics puzzle and attempt models."""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, PKMixin, TimestampMixin


class Puzzle(Base, PKMixin, TimestampMixin):
    __tablename__ = "puzzles"

    # Lichess-puzzle compatible shape: FEN + solution as a list of UCI moves.
    fen: Mapped[str] = mapped_column(String(120), nullable=False)
    moves: Mapped[list[str]] = mapped_column(ARRAY(String(8)), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, default=1200, nullable=False, index=True)
    themes: Mapped[list[str]] = mapped_column(
        ARRAY(String(48)), default=list, nullable=False
    )
    popularity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_daily: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    explanation_ml: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)


class PuzzleAttempt(Base, PKMixin, TimestampMixin):
    __tablename__ = "puzzle_attempts"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    puzzle_id: Mapped[int] = mapped_column(
        ForeignKey("puzzles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    solved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    rating_delta: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
