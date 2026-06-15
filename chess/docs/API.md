# API Reference

Base URL: `${NEXT_PUBLIC_API_URL}` → defaults to `http://localhost:8000/api/v1`.
Interactive docs are auto-generated at `/docs` (Swagger) and `/redoc`.

Authentication: `Authorization: Bearer <access_token>`.

## Auth

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | `{email, password, full_name?}` | → token pair |
| POST | `/auth/login` | `{email, password}` | → token pair |
| POST | `/auth/login/oauth` | form `username/password` | for Swagger Authorize |
| POST | `/auth/refresh` | `{refresh_token}` | → new token pair |
| GET  | `/auth/me` | — | current user |

## Analysis

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/analysis/evaluate` | `{fen, depth?}` | Stockfish eval (cp, mate, best move, PV) |
| POST | `/analysis/best-move` | `{fen, skill_level?}` | move for play-vs-AI (skill 0–20) |
| POST | `/analysis/move` | `{fen, move_uci, level?}` | classify + **Malayalam explanation** (quota) |
| POST | `/analysis/explain` | `{fen, move_uci?, level?}` | standalone Malayalam explanation (quota) |
| POST | `/analysis/review` | `{pgn, depth?}` | full game review + Malayalam summary (quota) |

`level` ∈ `beginner | intermediate | advanced`. `classification` ∈
`best | excellent | good | inaccuracy | mistake | blunder`.

## Puzzles

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/puzzles/daily` | daily puzzle |
| GET  | `/puzzles/next?theme=` | puzzle near user's rating (auth) |
| POST | `/puzzles/solve` | `{puzzle_id, moves[]}` → correct?, new rating, streak (auth) |

## Openings / Games / Leaderboard / Subscriptions

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/openings` | list openings |
| GET  | `/openings/{slug}` | opening detail + Malayalam ideas |
| GET  | `/games` | user's games (auth) |
| POST | `/games/upload` | multipart PGN upload (auth) |
| GET  | `/leaderboard?scope=kerala\|global` | rankings |
| GET  | `/subscriptions/pricing` | plan + features |
| POST | `/subscriptions/checkout` | create Razorpay/Stripe order (auth) |
| GET  | `/health` | status + engine availability |

## Errors

Standard FastAPI shape: `{"detail": "..."}`. Notable codes: `401`
unauthenticated, `402` daily free quota exceeded (message in Malayalam), `409`
email exists, `422` invalid FEN/PGN/move, `429` rate-limited.

## Example

```bash
curl -X POST http://localhost:8000/api/v1/analysis/explain \
  -H 'Content-Type: application/json' \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1","move_uci":"e7e5","level":"beginner"}'
```
