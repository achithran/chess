"""Tournament REST endpoints + WebSocket game server."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_optional_user
from app.db.session import get_db
from app.models.tournament import (
    GameStatus, LiveGame, PlayerRating, Tournament,
    TournamentParticipant, TournamentRound, TournamentStatus,
    ParticipantStatus,
)
from app.models.user import User
from app.schemas.tournament import (
    LiveGameDetail, LiveGameOut, PlayerRatingOut,
    TournamentCreate, TournamentDetail, TournamentOut,
)
from app.services.tournament_service import tournament_service
from app.services.ws_manager import game_channel, tournament_channel, ws_manager

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tournament_out(t: Tournament, participants=None) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "description": t.description,
        "format": t.format.value,
        "status": t.status.value,
        "organiser_id": t.organiser_id,
        "organiser_name": t.organiser.full_name if t.organiser else None,
        "time_control": t.time_control,
        "max_players": t.max_players,
        "rounds_total": t.rounds_total,
        "current_round": t.current_round,
        "entry_fee_inr": t.entry_fee_inr,
        "prize_pool_inr": t.prize_pool_inr,
        "invite_token": t.invite_token,
        "is_public": t.is_public,
        "starts_at": t.starts_at.isoformat() if t.starts_at else None,
        "participant_count": len(participants) if participants is not None else 0,
        "created_at": t.created_at.isoformat(),
    }


def _participant_out(p: TournamentParticipant) -> dict:
    return {
        "user_id": p.user_id,
        "user_name": p.user.full_name if p.user else None,
        "rating_at_entry": p.rating_at_entry,
        "points": p.points,
        "buchholz": p.buchholz,
        "games_played": p.games_played,
        "wins": p.wins,
        "draws": p.draws,
        "losses": p.losses,
        "final_rank": p.final_rank,
        "status": p.status.value,
    }


def _pairing_out(p) -> dict:
    return {
        "id": p.id,
        "board_number": p.board_number,
        "white_id": p.white_id,
        "white_name": p.white_player.full_name if p.white_player else None,
        "black_id": p.black_id,
        "black_name": p.black_player.full_name if p.black_player else None,
        "result": p.result.value,
        "game_id": p.game_id,
    }


def _game_out(g: LiveGame) -> dict:
    return {
        "id": g.id,
        "tournament_id": g.tournament_id,
        "white_id": g.white_id,
        "white_name": g.white_player.full_name if g.white_player else None,
        "white_rating": g.white_rating_before,
        "black_id": g.black_id,
        "black_name": g.black_player.full_name if g.black_player else None,
        "black_rating": g.black_rating_before,
        "time_control": g.time_control,
        "status": g.status.value,
        "result": g.result,
        "termination": g.termination.value if g.termination else None,
        "current_fen": g.current_fen,
        "white_time_ms": g.white_time_ms,
        "black_time_ms": g.black_time_ms,
        "started_at": g.started_at.isoformat() if g.started_at else None,
        "ended_at": g.ended_at.isoformat() if g.ended_at else None,
        "move_count": len(g.moves),
    }


# ── Tournament endpoints ──────────────────────────────────────────────────────

@router.get("", response_model=list[TournamentOut])
async def list_tournaments(
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
):
    rows = (
        await db.execute(
            select(Tournament)
            .where(Tournament.is_public == True)
            .order_by(Tournament.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    result = []
    for t in rows:
        await db.refresh(t, ["participants", "organiser"])
        result.append(_tournament_out(t, t.participants))
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tournament(
    body: TournamentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not (user.is_admin or user.is_organiser):
        raise HTTPException(403, "Organiser or admin role required.")
    t = await tournament_service.create(
        db,
        organiser_id=user.id,
        name=body.name,
        description=body.description,
        format=body.format,
        time_control=body.time_control,
        time_seconds=body.time_seconds,
        increment_seconds=body.increment_seconds,
        max_players=body.max_players,
        rounds_total=body.rounds_total,
        entry_fee_inr=body.entry_fee_inr,
        is_public=body.is_public,
        arena_duration_minutes=body.arena_duration_minutes,
        starts_at=body.starts_at,
    )
    await db.commit()
    await db.refresh(t, ["organiser", "participants"])
    return _tournament_out(t, t.participants)


@router.get("/join/{token}")
async def join_by_token(
    token: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Register via invite link."""
    t = (
        await db.execute(select(Tournament).where(Tournament.invite_token == token))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Invalid invite link.")
    if t.status not in (TournamentStatus.DRAFT, TournamentStatus.REGISTRATION):
        raise HTTPException(400, "Registration is closed.")

    await db.refresh(t, ["participants"])
    if len(t.participants) >= t.max_players:
        raise HTTPException(400, "Tournament is full.")

    rating = await _get_player_rating(db, user.id)
    await tournament_service.register_participant(db, t, user.id, rating)
    await db.commit()
    return {"tournament_id": t.id, "slug": t.slug}


@router.get("/{tournament_id}")
async def get_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    t = await _get_tournament(db, tournament_id)
    await db.refresh(t, ["participants", "rounds", "organiser"])
    for p in t.participants:
        await db.refresh(p, ["user"])
    rounds_out = []
    for rnd in t.rounds:
        await db.refresh(rnd, ["pairings"])
        pairings_out = []
        for pair in rnd.pairings:
            await db.refresh(pair, ["white_player", "black_player"])
            pairings_out.append(_pairing_out(pair))
        rounds_out.append({
            "id": rnd.id,
            "number": rnd.number,
            "started_at": rnd.started_at.isoformat() if rnd.started_at else None,
            "completed_at": rnd.completed_at.isoformat() if rnd.completed_at else None,
            "pairings": pairings_out,
        })
    out = _tournament_out(t, t.participants)
    out["participants"] = [_participant_out(p) for p in t.participants]
    out["rounds"] = rounds_out
    return out


@router.post("/{tournament_id}/open-registration")
async def open_registration(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = await _get_tournament(db, tournament_id)
    _assert_organiser(user, t)
    await tournament_service.open_registration(db, t)
    await db.commit()
    return {"status": t.status.value}


@router.post("/{tournament_id}/start")
async def start_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = await _get_tournament(db, tournament_id)
    _assert_organiser(user, t)
    if t.status not in (TournamentStatus.REGISTRATION, TournamentStatus.DRAFT):
        raise HTTPException(400, "Tournament cannot be started in its current state.")
    try:
        await tournament_service.start(db, t)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    await db.commit()
    await ws_manager.publish(tournament_channel(tournament_id), {"type": "tournament_started"})
    return {"status": t.status.value, "current_round": t.current_round}


@router.get("/{tournament_id}/standings")
async def standings(tournament_id: int, db: AsyncSession = Depends(get_db)):
    t = await _get_tournament(db, tournament_id)
    participants = (
        await db.execute(
            select(TournamentParticipant)
            .where(TournamentParticipant.tournament_id == tournament_id)
            .order_by(
                TournamentParticipant.points.desc(),
                TournamentParticipant.buchholz.desc(),
            )
        )
    ).scalars().all()
    for p in participants:
        await db.refresh(p, ["user"])
    return [_participant_out(p) for p in participants]


@router.get("/{tournament_id}/games")
async def tournament_games(tournament_id: int, db: AsyncSession = Depends(get_db)):
    games = (
        await db.execute(
            select(LiveGame)
            .where(LiveGame.tournament_id == tournament_id)
            .order_by(LiveGame.id.desc())
        )
    ).scalars().all()
    result = []
    for g in games:
        await db.refresh(g, ["white_player", "black_player", "moves"])
        result.append(_game_out(g))
    return result


# ── Live game endpoints ───────────────────────────────────────────────────────

@router.get("/games/{game_id}")
async def get_game(game_id: int, db: AsyncSession = Depends(get_db)):
    g = await _get_game(db, game_id)
    await db.refresh(g, ["white_player", "black_player", "moves"])
    out = _game_out(g)
    out["moves"] = [
        {"ply": m.ply, "uci": m.uci, "san": m.san, "fen_after": m.fen_after,
         "white_time_ms": m.white_time_ms, "black_time_ms": m.black_time_ms}
        for m in g.moves
    ]
    out["pgn"] = g.pgn
    return out


# ── Player rating ─────────────────────────────────────────────────────────────

@router.get("/ratings/me", response_model=PlayerRatingOut)
async def my_rating(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = await _get_player_rating_obj(db, user.id)
    return r


@router.get("/ratings/{user_id}", response_model=PlayerRatingOut)
async def player_rating(user_id: int, db: AsyncSession = Depends(get_db)):
    r = await _get_player_rating_obj(db, user_id)
    return r


# ── WebSocket: live game ──────────────────────────────────────────────────────

@router.websocket("/ws/game/{game_id}")
async def ws_game(
    game_id: int,
    websocket: WebSocket,
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Real-time game WebSocket.

    Query param ?token=<jwt> identifies the player.  Spectators connect without
    a token and receive move broadcasts but cannot send moves.
    """
    channel = game_channel(game_id)
    await ws_manager.connect(websocket, channel)

    # Authenticate player (optional — spectators have no token).
    current_user: User | None = None
    if token:
        try:
            from app.api.deps import get_optional_user as _opt
            from app.core.security import decode_token
            payload = decode_token(token, expected_type="access")
            from app.repositories.user_repository import UserRepository
            current_user = await UserRepository(db).get(int(payload["sub"]))
        except Exception:
            pass

    try:
        g = await _get_game(db, game_id)
        await db.refresh(g, ["white_player", "black_player", "moves"])

        # Send current game state immediately on connect.
        await ws_manager.send_personal(websocket, {
            "type": "game_state",
            "fen": g.current_fen,
            "white_time_ms": g.white_time_ms,
            "black_time_ms": g.black_time_ms,
            "status": g.status.value,
            "result": g.result,
            "moves": [{"uci": m.uci, "san": m.san} for m in g.moves],
            "white": {"id": g.white_id, "name": g.white_player.full_name},
            "black": {"id": g.black_id, "name": g.black_player.full_name},
        })

        # Mark game active when both players connect.
        if current_user and g.status == GameStatus.WAITING:
            if current_user.id in (g.white_id, g.black_id):
                from app.db.redis import redis_client
                connected_key = f"game:connected:{game_id}"
                await redis_client.sadd(connected_key, str(current_user.id))
                await redis_client.expire(connected_key, 3600)
                connected = await redis_client.scard(connected_key)
                if connected >= 2:
                    g.status = GameStatus.ACTIVE
                    g.started_at = _utcnow()
                    from app.db.redis import redis_client as rc
                    await rc.set(f"game:last_move_ts:{game_id}", str(_utcnow().timestamp()), ex=3600)
                    await db.commit()
                    await ws_manager.publish(channel, {"type": "game_started"})

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if not current_user:
                await ws_manager.send_personal(websocket, {"type": "error", "detail": "Not authenticated."})
                continue

            await db.refresh(g)
            msg_type = msg.get("type")

            if msg_type == "move":
                try:
                    payload = await tournament_service.apply_move(db, g, current_user.id, msg["uci"])
                    await db.commit()
                    await ws_manager.publish(channel, payload)
                    if "game_over" in payload and g.tournament_id:
                        await _handle_round_check(db, g)
                        await ws_manager.publish(tournament_channel(g.tournament_id), {
                            "type": "game_completed",
                            "game_id": game_id,
                            "result": payload["game_over"]["result"],
                        })
                except ValueError as exc:
                    await ws_manager.send_personal(websocket, {"type": "error", "detail": str(exc)})

            elif msg_type == "resign":
                try:
                    payload = await tournament_service.resign(db, g, current_user.id)
                    await db.commit()
                    await ws_manager.publish(channel, payload)
                    if g.tournament_id:
                        await _handle_round_check(db, g)
                except ValueError as exc:
                    await ws_manager.send_personal(websocket, {"type": "error", "detail": str(exc)})

            elif msg_type == "draw_offer":
                result = await tournament_service.handle_draw(db, g, current_user.id, accept=False)
                if result:
                    await db.commit()
                    await ws_manager.publish(channel, result)

            elif msg_type == "draw_response":
                accept = bool(msg.get("accept"))
                result = await tournament_service.handle_draw(db, g, current_user.id, accept=accept)
                if result:
                    await db.commit()
                    await ws_manager.publish(channel, result)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        ws_manager.disconnect(websocket)


@router.websocket("/ws/tournament/{tournament_id}")
async def ws_tournament(tournament_id: int, websocket: WebSocket):
    """Broadcast-only channel for tournament standings updates."""
    channel = tournament_channel(tournament_id)
    await ws_manager.connect(websocket, channel)
    try:
        while True:
            # Spectators only receive; keep connection alive.
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _get_tournament(db: AsyncSession, tournament_id: int) -> Tournament:
    t = (
        await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    ).scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Tournament not found.")
    return t


async def _get_game(db: AsyncSession, game_id: int) -> LiveGame:
    g = (
        await db.execute(select(LiveGame).where(LiveGame.id == game_id))
    ).scalar_one_or_none()
    if not g:
        raise HTTPException(404, "Game not found.")
    return g


async def _get_player_rating(db: AsyncSession, user_id: int) -> int:
    r = (
        await db.execute(select(PlayerRating).where(PlayerRating.user_id == user_id))
    ).scalar_one_or_none()
    return r.rating if r else 1200


async def _get_player_rating_obj(db: AsyncSession, user_id: int) -> PlayerRating:
    r = (
        await db.execute(select(PlayerRating).where(PlayerRating.user_id == user_id))
    ).scalar_one_or_none()
    if not r:
        r = PlayerRating(user_id=user_id)
        db.add(r)
        await db.commit()
        await db.refresh(r)
    return r


def _assert_organiser(user: User, tournament: Tournament) -> None:
    if not (user.is_admin or user.id == tournament.organiser_id):
        raise HTTPException(403, "Only the tournament organiser can do this.")


async def _handle_round_check(db: AsyncSession, game: LiveGame) -> None:
    if not game.tournament_id:
        return
    from sqlalchemy import select
    t = (
        await db.execute(select(Tournament).where(Tournament.id == game.tournament_id))
    ).scalar_one_or_none()
    if t:
        advanced = await tournament_service.check_round_complete(db, t)
        if advanced:
            await db.commit()
            await ws_manager.publish(tournament_channel(t.id), {
                "type": "round_complete",
                "round": t.current_round,
                "tournament_status": t.status.value,
            })
