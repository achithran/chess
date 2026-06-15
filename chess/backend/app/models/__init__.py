"""Aggregate import of all ORM models so metadata is fully populated."""
from app.models.user import User, SubscriptionPlan  # noqa: F401
from app.models.subscription import Subscription, Payment, Coupon  # noqa: F401
from app.models.game import Game, Analysis, MoveEvaluation  # noqa: F401
from app.models.puzzle import Puzzle, PuzzleAttempt  # noqa: F401
from app.models.opening import OpeningLesson  # noqa: F401
from app.models.explanation import AIExplanation  # noqa: F401
from app.models.rating import RatingHistory, LeaderboardEntry  # noqa: F401
from app.models.tournament import (  # noqa: F401
    Tournament, TournamentParticipant, TournamentRound, TournamentPairing,
    LiveGame, GameMove, PlayerRating, AntiCheatFlag,
    TournamentFormat, TournamentStatus, GameStatus, GameTermination,
)

__all__ = [
    "User", "SubscriptionPlan",
    "Subscription", "Payment", "Coupon",
    "Game", "Analysis", "MoveEvaluation",
    "Puzzle", "PuzzleAttempt",
    "OpeningLesson", "AIExplanation",
    "RatingHistory", "LeaderboardEntry",
    "Tournament", "TournamentParticipant", "TournamentRound", "TournamentPairing",
    "LiveGame", "GameMove", "PlayerRating", "AntiCheatFlag",
    "TournamentFormat", "TournamentStatus", "GameStatus", "GameTermination",
]
