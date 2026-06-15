"""Persisted AI explanation cache (mirrors the Redis hot cache).

Storing explanations keyed by a deterministic hash lets us reuse expensive
OpenAI completions across users and survive Redis eviction.
"""
from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, PKMixin, TimestampMixin


class AIExplanation(Base, PKMixin, TimestampMixin):
    __tablename__ = "ai_explanations"

    cache_key: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    fen: Mapped[str | None] = mapped_column(String(120), nullable=True)
    move_uci: Mapped[str | None] = mapped_column(String(8), nullable=True)
    level: Mapped[str] = mapped_column(String(16), default="beginner", nullable=False)
    text_ml: Mapped[str] = mapped_column(Text, nullable=False)
    text_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
