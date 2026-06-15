"""Opening lesson model used by the opening trainer / explorer."""
from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, PKMixin, TimestampMixin


class OpeningLesson(Base, PKMixin, TimestampMixin):
    __tablename__ = "opening_lessons"

    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    eco: Mapped[str | None] = mapped_column(String(4), nullable=True)
    # Main-line moves in SAN, e.g. ["e4", "e5", "Nf3", "Nc6", "Bc4"].
    moves: Mapped[list[str]] = mapped_column(ARRAY(String(12)), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description_ml: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    ideas_ml: Mapped[str | None] = mapped_column(Text, nullable=True)
