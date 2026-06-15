"""Standard ELO rating calculation for live chess games.

K-factor schedule:
  K=40  — first 30 games (provisional)
  K=20  — rating < 2400
  K=10  — rating >= 2400
"""
from __future__ import annotations

import math


def _k_factor(rating: int, games_played: int) -> int:
    if games_played < 30:
        return 40
    if rating >= 2400:
        return 10
    return 20


def expected_score(rating_a: int, rating_b: int) -> float:
    """Expected score for player A against player B (0-1)."""
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def new_ratings(
    white_rating: int,
    black_rating: int,
    result: str,           # "1-0", "0-1", "1/2-1/2"
    white_games: int = 0,
    black_games: int = 0,
) -> tuple[int, int]:
    """Return (new_white_rating, new_black_rating)."""
    score_w = {"1-0": 1.0, "0-1": 0.0, "1/2-1/2": 0.5}.get(result, 0.5)
    score_b = 1.0 - score_w

    exp_w = expected_score(white_rating, black_rating)
    exp_b = 1.0 - exp_w

    k_w = _k_factor(white_rating, white_games)
    k_b = _k_factor(black_rating, black_games)

    new_w = white_rating + round(k_w * (score_w - exp_w))
    new_b = black_rating + round(k_b * (score_b - exp_b))

    # Ratings don't go below 100.
    return max(100, new_w), max(100, new_b)


def rating_change(
    rating: int, opponent_rating: int, score: float, games_played: int = 0
) -> int:
    """Delta for a single player (score: 1=win, 0.5=draw, 0=loss)."""
    exp = expected_score(rating, opponent_rating)
    k = _k_factor(rating, games_played)
    return round(k * (score - exp))


def performance_rating(opponents: list[int], scores: list[float]) -> int:
    """Tournament performance rating from a list of opponents and scores."""
    if not opponents:
        return 1200
    avg_opp = sum(opponents) / len(opponents)
    total_score = sum(scores)
    pct = total_score / len(scores) if scores else 0.5
    # Cap percentage to avoid infinite DP offset.
    pct = max(0.01, min(0.99, pct))
    dp = -400 * math.log10(1 / pct - 1)
    return round(avg_opp + dp)
