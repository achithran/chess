"""Tournament lifecycle management service.

Handles: create → open registration → start → round management →
         complete games → advance rounds → finalize → prize distribution.
"""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone

import chess

from app.core.logging import get_logger
from app.models.tournament import (
    GameMove, GameStatus, GameTermination, LiveGame,
    PairingResult, PlayerRating, Tournament, TournamentFormat,
    TournamentParticipant, TournamentPairing, TournamentRound,
    TournamentStatus, ParticipantStatus,
)
from app.services.elo_service import new_ratings
from app.services.pairing_engine import (
    Standing, arena_pairings, knockout_bracket, next_knockout_round,
    round_robin_schedule, swiss_pairings,
)

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _slug(name: str, token: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]
    return f"{base}-{token[:6]}"


class TournamentService:

    # ── Tournament CRUD ───────────────────────────────────────────────────────

    async def create(self, db, organiser_id: int, **kwargs) -> Tournament:
        token = secrets.token_urlsafe(16)
        t = Tournament(
            organiser_id=organiser_id,
            invite_token=token,
            slug=_slug(kwargs["name"], token),
            **kwargs,
        )
        db.add(t)
        await db.flush()
        await db.refresh(t)
        return t

    async def open_registration(self, db, tournament: Tournament) -> None:
        tournament.status = TournamentStatus.REGISTRATION
        await db.flush()

    async def register_participant(
        self, db, tournament: Tournament, user_id: int, rating: int
    ) -> TournamentParticipant:
        from sqlalchemy import select
        existing = (
            await db.execute(
                select(TournamentParticipant).where(
                    TournamentParticipant.tournament_id == tournament.id,
                    TournamentParticipant.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing
        p = TournamentParticipant(
            tournament_id=tournament.id,
            user_id=user_id,
            rating_at_entry=rating,
            status=ParticipantStatus.REGISTERED,
        )
        db.add(p)
        await db.flush()
        return p

    # ── Starting and round management ─────────────────────────────────────────

    async def start(self, db, tournament: Tournament) -> None:
        from sqlalchemy import select
        participants = (
            await db.execute(
                select(TournamentParticipant).where(
                    TournamentParticipant.tournament_id == tournament.id,
                    TournamentParticipant.status != ParticipantStatus.WITHDRAWN,
                )
            )
        ).scalars().all()

        if len(participants) < 2:
            raise ValueError("Need at least 2 participants to start.")

        if tournament.rounds_total is None:
            # Swiss default: ceil(log2(n)) rounds
            import math
            tournament.rounds_total = max(3, math.ceil(math.log2(len(participants))))

        tournament.status = TournamentStatus.ACTIVE
        tournament.current_round = 0
        await db.flush()

        if tournament.format == TournamentFormat.ROUND_ROBIN:
            await self._schedule_round_robin(db, tournament, participants)
        else:
            await self._create_next_round(db, tournament, participants)

    async def _schedule_round_robin(self, db, tournament: Tournament, participants) -> None:
        ids = [p.user_id for p in participants]
        all_rounds = round_robin_schedule(ids)
        for rnd_num, pairings in enumerate(all_rounds, 1):
            rnd = TournamentRound(tournament_id=tournament.id, number=rnd_num)
            db.add(rnd)
            await db.flush()
            for board, (white_id, black_id) in enumerate(pairings, 1):
                game = await self._create_live_game(db, tournament, white_id, black_id)
                p = TournamentPairing(
                    round_id=rnd.id,
                    white_id=white_id,
                    black_id=black_id,
                    board_number=board,
                    game_id=game.id if game else None,
                    result=PairingResult.PENDING if black_id else PairingResult.WHITE_WIN,
                )
                db.add(p)
        tournament.current_round = 1
        await db.flush()

    async def _create_next_round(self, db, tournament: Tournament, participants=None) -> None:
        from sqlalchemy import select
        if participants is None:
            participants = (
                await db.execute(
                    select(TournamentParticipant).where(
                        TournamentParticipant.tournament_id == tournament.id,
                        TournamentParticipant.status != ParticipantStatus.WITHDRAWN,
                    )
                )
            ).scalars().all()

        tournament.current_round += 1
        rnd = TournamentRound(
            tournament_id=tournament.id,
            number=tournament.current_round,
            started_at=_utcnow(),
        )
        db.add(rnd)
        await db.flush()

        if tournament.format == TournamentFormat.SWISS:
            standings = [
                Standing(
                    user_id=p.user_id,
                    rating=p.rating_at_entry,
                    points=p.points,
                    opponents=await self._get_opponent_ids(db, tournament.id, p.user_id),
                )
                for p in participants
            ]
            raw_pairings = swiss_pairings(standings)

        elif tournament.format == TournamentFormat.KNOCKOUT:
            if tournament.current_round == 1:
                ratings = {p.user_id: p.rating_at_entry for p in participants}
                raw_pairings = knockout_bracket([p.user_id for p in participants], ratings)[0]
            else:
                prev_results = await self._get_knockout_results(db, tournament.id, tournament.current_round - 1)
                raw_pairings = next_knockout_round(prev_results)
        else:
            raw_pairings = []

        for board, (white_id, black_id) in enumerate(raw_pairings, 1):
            if black_id is None:
                p = TournamentPairing(
                    round_id=rnd.id, white_id=white_id, black_id=None,
                    board_number=board, result=PairingResult.WHITE_WIN,
                )
                db.add(p)
                await self._credit_bye(db, tournament.id, white_id)
            else:
                game = await self._create_live_game(db, tournament, white_id, black_id)
                p = TournamentPairing(
                    round_id=rnd.id, white_id=white_id, black_id=black_id,
                    board_number=board, game_id=game.id,
                )
                db.add(p)

        await db.flush()

    async def _get_opponent_ids(self, db, tournament_id: int, user_id: int) -> list[int]:
        from sqlalchemy import select, or_
        rows = (
            await db.execute(
                select(TournamentPairing).join(TournamentRound).where(
                    TournamentRound.tournament_id == tournament_id,
                    or_(
                        TournamentPairing.white_id == user_id,
                        TournamentPairing.black_id == user_id,
                    ),
                )
            )
        ).scalars().all()
        result = []
        for r in rows:
            if r.white_id == user_id and r.black_id:
                result.append(r.black_id)
            elif r.black_id == user_id:
                result.append(r.white_id)
        return result

    async def _get_knockout_results(
        self, db, tournament_id: int, round_num: int
    ) -> list[tuple[int, int | None, str]]:
        from sqlalchemy import select
        rnd = (
            await db.execute(
                select(TournamentRound).where(
                    TournamentRound.tournament_id == tournament_id,
                    TournamentRound.number == round_num,
                )
            )
        ).scalar_one_or_none()
        if not rnd:
            return []
        pairings = (
            await db.execute(
                select(TournamentPairing).where(TournamentPairing.round_id == rnd.id)
            )
        ).scalars().all()
        return [
            (p.white_id, p.black_id, _pairing_result_to_game_result(p.result))
            for p in pairings
        ]

    async def _create_live_game(
        self, db, tournament: Tournament, white_id: int, black_id: int | None
    ) -> LiveGame | None:
        if black_id is None:
            return None
        game = LiveGame(
            tournament_id=tournament.id,
            white_id=white_id,
            black_id=black_id,
            time_control=tournament.time_control,
            time_seconds=tournament.time_seconds,
            increment_seconds=tournament.increment_seconds,
            white_time_ms=tournament.time_seconds * 1000,
            black_time_ms=tournament.time_seconds * 1000,
            status=GameStatus.WAITING,
        )
        db.add(game)
        await db.flush()
        return game

    async def _credit_bye(self, db, tournament_id: int, user_id: int) -> None:
        from sqlalchemy import select
        p = (
            await db.execute(
                select(TournamentParticipant).where(
                    TournamentParticipant.tournament_id == tournament_id,
                    TournamentParticipant.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if p:
            p.points += 1.0
            p.games_played += 1

    # ── Game moves ────────────────────────────────────────────────────────────

    async def apply_move(
        self, db, game: LiveGame, mover_id: int, uci: str
    ) -> dict:
        """Validate and persist a move. Returns the broadcast payload."""
        if game.status != GameStatus.ACTIVE:
            raise ValueError("Game is not active.")

        board = chess.Board(game.current_fen)
        is_white_turn = board.turn == chess.WHITE
        expected_id = game.white_id if is_white_turn else game.black_id

        if mover_id != expected_id:
            raise ValueError("It is not your turn.")

        try:
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                raise ValueError("Illegal move.")
            san = board.san(move)
            board.push(move)
        except Exception as exc:
            raise ValueError(str(exc))

        # Clock update — deduct elapsed time, add increment.
        now = _utcnow()
        from app.db.redis import redis_client
        last_ts_key = f"game:last_move_ts:{game.id}"
        last_ts_raw = await redis_client.get(last_ts_key)
        if last_ts_raw and game.status == GameStatus.ACTIVE:
            elapsed_ms = int((now.timestamp() - float(last_ts_raw)) * 1000)
            if is_white_turn:
                game.white_time_ms = max(0, game.white_time_ms - elapsed_ms + game.increment_seconds * 1000)
            else:
                game.black_time_ms = max(0, game.black_time_ms - elapsed_ms + game.increment_seconds * 1000)
        await redis_client.set(last_ts_key, str(now.timestamp()), ex=3600)

        ply = len(list(board.move_stack))
        new_fen = board.fen()
        game.current_fen = new_fen

        move_record = GameMove(
            game_id=game.id,
            ply=ply,
            uci=uci,
            san=san,
            fen_after=new_fen,
            white_time_ms=game.white_time_ms,
            black_time_ms=game.black_time_ms,
            moved_at=now,
        )
        db.add(move_record)

        # Check game-ending conditions.
        termination: GameTermination | None = None
        result: str | None = None

        if board.is_checkmate():
            result = "1-0" if not board.turn == chess.WHITE else "0-1"
            termination = GameTermination.CHECKMATE
        elif board.is_stalemate():
            result, termination = "1/2-1/2", GameTermination.STALEMATE
        elif board.is_insufficient_material():
            result, termination = "1/2-1/2", GameTermination.INSUFFICIENT
        elif board.is_seventyfive_moves():
            result, termination = "1/2-1/2", GameTermination.FIFTY_MOVE
        elif board.is_fivefold_repetition():
            result, termination = "1/2-1/2", GameTermination.REPETITION
        elif game.white_time_ms == 0:
            result, termination = "0-1", GameTermination.TIMEOUT
        elif game.black_time_ms == 0:
            result, termination = "1-0", GameTermination.TIMEOUT

        if result:
            await self._finalize_game(db, game, result, termination)

        await db.flush()

        payload: dict = {
            "type": "move",
            "uci": uci,
            "san": san,
            "fen": new_fen,
            "ply": ply,
            "white_time_ms": game.white_time_ms,
            "black_time_ms": game.black_time_ms,
        }
        if result:
            payload["game_over"] = {"result": result, "termination": termination.value if termination else None}
        return payload

    async def resign(self, db, game: LiveGame, resigner_id: int) -> dict:
        if game.status != GameStatus.ACTIVE:
            raise ValueError("Game is not active.")
        result = "0-1" if resigner_id == game.white_id else "1-0"
        await self._finalize_game(db, game, result, GameTermination.RESIGNATION)
        await db.flush()
        return {"type": "game_over", "result": result, "termination": "resignation"}

    async def handle_draw(self, db, game: LiveGame, actor_id: int, accept: bool) -> dict | None:
        if game.status != GameStatus.ACTIVE:
            raise ValueError("Game is not active.")
        color = "white" if actor_id == game.white_id else "black"
        if not accept:
            game.draw_offered_by = color
            await db.flush()
            return {"type": "draw_offered", "by": color}
        if game.draw_offered_by and game.draw_offered_by != color:
            await self._finalize_game(db, game, "1/2-1/2", GameTermination.DRAW_AGREEMENT)
            await db.flush()
            return {"type": "game_over", "result": "1/2-1/2", "termination": "draw_agreement"}
        return None

    # ── Game finalization ─────────────────────────────────────────────────────

    async def _finalize_game(
        self, db, game: LiveGame, result: str, termination: GameTermination | None
    ) -> None:
        game.status = GameStatus.COMPLETED
        game.result = result
        game.termination = termination
        game.ended_at = _utcnow()
        game.draw_offered_by = None

        await self._update_ratings(db, game, result)
        if game.tournament_id and game.pairing_id:
            await self._update_pairing(db, game, result)
            await self._update_participant_scores(db, game, result)

    async def _update_ratings(self, db, game: LiveGame, result: str) -> None:
        from sqlalchemy import select

        async def get_or_create_rating(user_id: int) -> PlayerRating:
            r = (
                await db.execute(select(PlayerRating).where(PlayerRating.user_id == user_id))
            ).scalar_one_or_none()
            if not r:
                r = PlayerRating(user_id=user_id)
                db.add(r)
                await db.flush()
            return r

        wr = await get_or_create_rating(game.white_id)
        br = await get_or_create_rating(game.black_id)

        game.white_rating_before = wr.rating
        game.black_rating_before = br.rating

        new_w, new_b = new_ratings(
            wr.rating, br.rating, result, wr.games_played, br.games_played
        )

        wr.rating = new_w
        br.rating = new_b
        wr.peak_rating = max(wr.peak_rating, new_w)
        br.peak_rating = max(br.peak_rating, new_b)
        wr.games_played += 1
        br.games_played += 1

        if result == "1-0":
            wr.wins += 1; br.losses += 1
        elif result == "0-1":
            wr.losses += 1; br.wins += 1
        else:
            wr.draws += 1; br.draws += 1

        game.white_rating_after = new_w
        game.black_rating_after = new_b

    async def _update_pairing(self, db, game: LiveGame, result: str) -> None:
        from sqlalchemy import select
        pairing = (
            await db.execute(
                select(TournamentPairing).where(TournamentPairing.id == game.pairing_id)
            )
        ).scalar_one_or_none()
        if not pairing:
            return
        if result == "1-0":
            pairing.result = PairingResult.WHITE_WIN
        elif result == "0-1":
            pairing.result = PairingResult.BLACK_WIN
        else:
            pairing.result = PairingResult.DRAW

    async def _update_participant_scores(self, db, game: LiveGame, result: str) -> None:
        from sqlalchemy import select

        async def get_p(user_id: int) -> TournamentParticipant | None:
            return (
                await db.execute(
                    select(TournamentParticipant).where(
                        TournamentParticipant.tournament_id == game.tournament_id,
                        TournamentParticipant.user_id == user_id,
                    )
                )
            ).scalar_one_or_none()

        wp = await get_p(game.white_id)
        bp = await get_p(game.black_id)
        for p in filter(None, [wp, bp]):
            p.games_played += 1

        if result == "1-0":
            if wp: wp.points += 1.0; wp.wins += 1
            if bp: bp.losses += 1
        elif result == "0-1":
            if bp: bp.points += 1.0; bp.wins += 1
            if wp: wp.losses += 1
        else:
            if wp: wp.points += 0.5; wp.draws += 1
            if bp: bp.points += 0.5; bp.draws += 1

    # ── Round / tournament completion ─────────────────────────────────────────

    async def check_round_complete(self, db, tournament: Tournament) -> bool:
        """Returns True if the current round is done and the next was started."""
        from sqlalchemy import select
        rnd = (
            await db.execute(
                select(TournamentRound).where(
                    TournamentRound.tournament_id == tournament.id,
                    TournamentRound.number == tournament.current_round,
                )
            )
        ).scalar_one_or_none()
        if not rnd:
            return False

        pending = (
            await db.execute(
                select(TournamentPairing).where(
                    TournamentPairing.round_id == rnd.id,
                    TournamentPairing.result == PairingResult.PENDING,
                )
            )
        ).scalars().all()

        if pending:
            return False

        rnd.completed_at = _utcnow()

        if tournament.current_round >= (tournament.rounds_total or 0):
            await self._finalize_tournament(db, tournament)
            return True

        if tournament.format not in (TournamentFormat.ROUND_ROBIN,):
            await self._create_next_round(db, tournament)
        else:
            tournament.current_round += 1
        return True

    async def _finalize_tournament(self, db, tournament: Tournament) -> None:
        from sqlalchemy import select
        tournament.status = TournamentStatus.COMPLETED
        tournament.ends_at = _utcnow()

        participants = (
            await db.execute(
                select(TournamentParticipant).where(
                    TournamentParticipant.tournament_id == tournament.id
                ).order_by(
                    TournamentParticipant.points.desc(),
                    TournamentParticipant.buchholz.desc(),
                )
            )
        ).scalars().all()

        for rank, p in enumerate(participants, 1):
            p.final_rank = rank

        # Distribute prize pool: 60% first, 30% second, 10% third.
        prize_splits = [0.60, 0.30, 0.10]
        net_pool = tournament.prize_pool_inr * (1 - tournament.platform_cut_pct / 100)
        for i, p in enumerate(participants[:3]):
            p.prize_inr = int(net_pool * prize_splits[i])

        logger.info("tournament.completed", extra={"tournament_id": tournament.id})


def _pairing_result_to_game_result(r: PairingResult) -> str:
    return {"white_win": "1-0", "black_win": "0-1", "draw": "1/2-1/2"}.get(r.value, "*")


tournament_service = TournamentService()
