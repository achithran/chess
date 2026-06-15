"""Game, analysis and per-move evaluation models."""
from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class GameSource(str, enum.Enum):
    PLAYED = "played"        # played vs AI inside the app
    UPLOADED = "uploaded"    # PGN uploaded for review
    IMPORTED = "imported"    # imported from lichess/chess.com


class GameResult(str, enum.Enum):
    WHITE = "1-0"
    BLACK = "0-1"
    DRAW = "1/2-1/2"
    UNKNOWN = "*"


class Game(Base, PKMixin, TimestampMixin):
    __tablename__ = "games"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[GameSource] = mapped_column(
        Enum(GameSource), default=GameSource.PLAYED, nullable=False
    )
    pgn: Mapped[str] = mapped_column(Text, nullable=False)
    white: Mapped[str | None] = mapped_column(String(128), nullable=True)
    black: Mapped[str | None] = mapped_column(String(128), nullable=True)
    result: Mapped[GameResult] = mapped_column(
        Enum(GameResult), default=GameResult.UNKNOWN, nullable=False
    )
    opening_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    eco: Mapped[str | None] = mapped_column(String(4), nullable=True)

    user: Mapped["User"] = relationship(back_populates="games")
    analysis: Mapped["Analysis | None"] = relationship(
        back_populates="game", uselist=False, cascade="all, delete-orphan"
    )


class Analysis(Base, PKMixin, TimestampMixin):
    __tablename__ = "analyses"

    game_id: Mapped[int] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    accuracy_white: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy_black: Mapped[float | None] = mapped_column(Float, nullable=True)
    blunders: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mistakes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    inaccuracies: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    summary_ml: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_en: Mapped[str | None] = mapped_column(Text, nullable=True)

    game: Mapped["Game"] = relationship(back_populates="analysis")
    moves: Mapped[list["MoveEvaluation"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )


class MoveClassification(str, enum.Enum):
    BEST = "best"
    EXCELLENT = "excellent"
    GOOD = "good"
    INACCURACY = "inaccuracy"
    MISTAKE = "mistake"
    BLUNDER = "blunder"


class MoveEvaluation(Base, PKMixin):
    __tablename__ = "move_evaluations"

    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ply: Mapped[int] = mapped_column(Integer, nullable=False)
    fen_before: Mapped[str] = mapped_column(String(120), nullable=False)
    move_san: Mapped[str] = mapped_column(String(12), nullable=False)
    best_move_san: Mapped[str | None] = mapped_column(String(12), nullable=True)
    eval_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    eval_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    centipawn_loss: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    classification: Mapped[MoveClassification] = mapped_column(
        Enum(MoveClassification), default=MoveClassification.GOOD, nullable=False
    )
    explanation_ml: Mapped[str | None] = mapped_column(Text, nullable=True)

    analysis: Mapped["Analysis"] = relationship(back_populates="moves")
