"""Tournament, live-game, player-rating and anti-cheat models."""
from __future__ import annotations

import enum
import secrets
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PKMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


# ── Enums ────────────────────────────────────────────────────────────────────

class TournamentFormat(str, enum.Enum):
    SWISS       = "swiss"
    ROUND_ROBIN = "round_robin"
    KNOCKOUT    = "knockout"
    ARENA       = "arena"


class TournamentStatus(str, enum.Enum):
    DRAFT        = "draft"
    REGISTRATION = "registration"
    ACTIVE       = "active"
    COMPLETED    = "completed"
    CANCELLED    = "cancelled"


class ParticipantStatus(str, enum.Enum):
    REGISTERED = "registered"
    ACTIVE     = "active"
    WITHDRAWN  = "withdrawn"


class PairingResult(str, enum.Enum):
    PENDING = "pending"
    WHITE_WIN = "white_win"
    BLACK_WIN = "black_win"
    DRAW      = "draw"
    FORFEIT   = "forfeit"


class GameStatus(str, enum.Enum):
    WAITING   = "waiting"   # created, players not yet connected
    ACTIVE    = "active"    # both connected, clock running
    COMPLETED = "completed"
    ABORTED   = "aborted"


class GameTermination(str, enum.Enum):
    CHECKMATE      = "checkmate"
    TIMEOUT        = "timeout"
    RESIGNATION    = "resignation"
    DRAW_AGREEMENT = "draw_agreement"
    STALEMATE      = "stalemate"
    INSUFFICIENT   = "insufficient_material"
    REPETITION     = "repetition"
    FIFTY_MOVE     = "fifty_move"
    ABORT          = "abort"


# ── Tournament ────────────────────────────────────────────────────────────────

class Tournament(Base, PKMixin, TimestampMixin):
    __tablename__ = "tournaments"

    name: Mapped[str]        = mapped_column(String(200), nullable=False)
    slug: Mapped[str]        = mapped_column(String(220), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    format: Mapped[TournamentFormat] = mapped_column(
        Enum(TournamentFormat), default=TournamentFormat.SWISS, nullable=False
    )
    status: Mapped[TournamentStatus] = mapped_column(
        Enum(TournamentStatus), default=TournamentStatus.DRAFT, nullable=False
    )

    organiser_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Time control — stored as "3+2" string plus parsed ints for convenience.
    time_control: Mapped[str]           = mapped_column(String(16), nullable=False, default="3+2")
    time_seconds: Mapped[int]           = mapped_column(Integer, nullable=False, default=180)
    increment_seconds: Mapped[int]      = mapped_column(Integer, nullable=False, default=2)

    max_players: Mapped[int]            = mapped_column(Integer, nullable=False, default=32)
    rounds_total: Mapped[int | None]    = mapped_column(Integer, nullable=True)   # None = arena
    current_round: Mapped[int]          = mapped_column(Integer, nullable=False, default=0)

    # Monetisation
    entry_fee_inr: Mapped[int]          = mapped_column(Integer, nullable=False, default=0)
    prize_pool_inr: Mapped[int]         = mapped_column(Integer, nullable=False, default=0)
    platform_cut_pct: Mapped[int]       = mapped_column(Integer, nullable=False, default=15)

    # Access
    invite_token: Mapped[str]           = mapped_column(
        String(32), unique=True, nullable=False,
        default=lambda: secrets.token_urlsafe(16),
    )
    is_public: Mapped[bool]             = mapped_column(Boolean, nullable=False, default=False)

    # Arena-specific: how long the arena runs (minutes)
    arena_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    starts_at: Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None]    = mapped_column(DateTime(timezone=True), nullable=True)

    organiser:    Mapped["User"]                       = relationship(foreign_keys=[organiser_id])
    participants: Mapped[list["TournamentParticipant"]] = relationship(
        back_populates="tournament", cascade="all, delete-orphan"
    )
    rounds:       Mapped[list["TournamentRound"]]      = relationship(
        back_populates="tournament", cascade="all, delete-orphan", order_by="TournamentRound.number"
    )


# ── Participants ──────────────────────────────────────────────────────────────

class TournamentParticipant(Base, PKMixin, TimestampMixin):
    __tablename__ = "tournament_participants"
    __table_args__ = (UniqueConstraint("tournament_id", "user_id"),)

    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status: Mapped[ParticipantStatus] = mapped_column(
        Enum(ParticipantStatus), default=ParticipantStatus.REGISTERED, nullable=False
    )

    # Swiss / RR scoring
    points: Mapped[float]       = mapped_column(Float, nullable=False, default=0.0)
    buchholz: Mapped[float]     = mapped_column(Float, nullable=False, default=0.0)  # tiebreak
    games_played: Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    wins: Mapped[int]           = mapped_column(Integer, nullable=False, default=0)
    draws: Mapped[int]          = mapped_column(Integer, nullable=False, default=0)
    losses: Mapped[int]         = mapped_column(Integer, nullable=False, default=0)

    rating_at_entry: Mapped[int]  = mapped_column(Integer, nullable=False, default=1200)

    # Payment
    paid: Mapped[bool]            = mapped_column(Boolean, nullable=False, default=False)
    payment_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Final result
    final_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prize_inr: Mapped[int]         = mapped_column(Integer, nullable=False, default=0)

    tournament: Mapped["Tournament"]  = relationship(back_populates="participants")
    user:       Mapped["User"]        = relationship(foreign_keys=[user_id])


# ── Rounds & Pairings ─────────────────────────────────────────────────────────

class TournamentRound(Base, PKMixin, TimestampMixin):
    __tablename__ = "tournament_rounds"

    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)

    started_at: Mapped[datetime | None]   = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tournament: Mapped["Tournament"]        = relationship(back_populates="rounds")
    pairings:   Mapped[list["TournamentPairing"]] = relationship(
        back_populates="round", cascade="all, delete-orphan"
    )


class TournamentPairing(Base, PKMixin, TimestampMixin):
    __tablename__ = "tournament_pairings"

    round_id: Mapped[int] = mapped_column(
        ForeignKey("tournament_rounds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    white_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    black_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True  # None = bye
    )

    result: Mapped[PairingResult] = mapped_column(
        Enum(PairingResult), default=PairingResult.PENDING, nullable=False
    )

    game_id: Mapped[int | None] = mapped_column(
        ForeignKey("live_games.id", ondelete="SET NULL"), nullable=True
    )

    board_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    round:        Mapped["TournamentRound"] = relationship(back_populates="pairings")
    white_player: Mapped["User"]            = relationship(foreign_keys=[white_id])
    black_player: Mapped["User | None"]     = relationship(foreign_keys=[black_id])
    game:         Mapped["LiveGame | None"] = relationship(foreign_keys=[game_id])


# ── Live Games ────────────────────────────────────────────────────────────────

class LiveGame(Base, PKMixin, TimestampMixin):
    __tablename__ = "live_games"

    tournament_id: Mapped[int | None] = mapped_column(
        ForeignKey("tournaments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pairing_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    white_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    black_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    time_control: Mapped[str]       = mapped_column(String(16), nullable=False)
    time_seconds: Mapped[int]       = mapped_column(Integer, nullable=False)
    increment_seconds: Mapped[int]  = mapped_column(Integer, nullable=False, default=0)

    status: Mapped[GameStatus] = mapped_column(
        Enum(GameStatus), default=GameStatus.WAITING, nullable=False, index=True
    )
    result: Mapped[str | None]         = mapped_column(String(8), nullable=True)   # "1-0" etc
    termination: Mapped[GameTermination | None] = mapped_column(
        Enum(GameTermination), nullable=True
    )

    current_fen: Mapped[str] = mapped_column(
        String(120), nullable=False,
        default="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    )
    pgn: Mapped[str | None] = mapped_column(Text, nullable=True)

    white_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    black_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    white_rating_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_rating_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    white_rating_after:  Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_rating_after:  Mapped[int | None] = mapped_column(Integer, nullable=True)

    draw_offered_by: Mapped[str | None] = mapped_column(String(8), nullable=True)  # "white"/"black"

    started_at: Mapped[datetime | None]   = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at:   Mapped[datetime | None]   = mapped_column(DateTime(timezone=True), nullable=True)

    white_player: Mapped["User"]        = relationship(foreign_keys=[white_id])
    black_player: Mapped["User"]        = relationship(foreign_keys=[black_id])
    moves:        Mapped[list["GameMove"]] = relationship(
        back_populates="game", cascade="all, delete-orphan", order_by="GameMove.ply"
    )


class GameMove(Base, PKMixin):
    __tablename__ = "game_moves"

    game_id: Mapped[int] = mapped_column(
        ForeignKey("live_games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ply:          Mapped[int]      = mapped_column(Integer, nullable=False)
    uci:          Mapped[str]      = mapped_column(String(6), nullable=False)
    san:          Mapped[str]      = mapped_column(String(12), nullable=False)
    fen_after:    Mapped[str]      = mapped_column(String(120), nullable=False)
    white_time_ms: Mapped[int]     = mapped_column(Integer, nullable=False)
    black_time_ms: Mapped[int]     = mapped_column(Integer, nullable=False)
    moved_at:     Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    game: Mapped["LiveGame"] = relationship(back_populates="moves")


# ── Player Ratings (live game ELO) ────────────────────────────────────────────

class PlayerRating(Base, PKMixin, TimestampMixin):
    __tablename__ = "player_ratings"
    __table_args__ = (UniqueConstraint("user_id"),)

    user_id:      Mapped[int]   = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating:       Mapped[int]   = mapped_column(Integer, nullable=False, default=1200)
    games_played: Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    wins:         Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    losses:       Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    draws:        Mapped[int]   = mapped_column(Integer, nullable=False, default=0)
    peak_rating:  Mapped[int]   = mapped_column(Integer, nullable=False, default=1200)

    user: Mapped["User"] = relationship(foreign_keys=[user_id])


# ── Anti-cheat ────────────────────────────────────────────────────────────────

class AntiCheatFlag(Base, PKMixin, TimestampMixin):
    __tablename__ = "anti_cheat_flags"

    game_id:     Mapped[int]        = mapped_column(
        ForeignKey("live_games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id:     Mapped[int]        = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    engine_match_pct: Mapped[float] = mapped_column(Float, nullable=False)
    top1_match_pct:   Mapped[float] = mapped_column(Float, nullable=False)
    moves_analysed:   Mapped[int]   = mapped_column(Integer, nullable=False)
    flagged:     Mapped[bool]       = mapped_column(Boolean, nullable=False, default=False)
    reviewed:    Mapped[bool]       = mapped_column(Boolean, nullable=False, default=False)
    notes:       Mapped[str | None] = mapped_column(Text, nullable=True)

    game: Mapped["LiveGame"] = relationship(foreign_keys=[game_id])
    user: Mapped["User"]     = relationship(foreign_keys=[user_id])
