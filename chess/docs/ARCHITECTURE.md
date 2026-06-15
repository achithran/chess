# Architecture

## Layered backend

```
HTTP → api/routers → services → repositories → models → Postgres
                  ↘ services → Stockfish / OpenAI / Redis
```

- **Routers** (`api/routers/*`): thin HTTP handlers, validation, dependency
  wiring. No business logic.
- **Dependencies** (`api/deps.py`): `get_current_user`, `get_current_admin`,
  `enforce_daily_analysis_quota` (Redis counter), OAuth2 bearer.
- **Services** (`services/*`): business logic.
  - `StockfishService` — pooled UCI engine, async via `asyncio.to_thread`,
    material-heuristic fallback when the binary is missing.
  - `AIExplanationService` — Malayalam explanation pipeline with Redis + DB
    caching and a deterministic template fallback. Cache key is a hash of
    `(fen, move, level, classification)` so identical positions are free.
  - `AnalysisService` — composes Stockfish + explanations for single-move
    analysis and full PGN review (accuracy via cpl→sigmoid).
  - `AuthService` — register/login/refresh, Google upsert.
- **Repositories** (`repositories/*`): all SQL lives here (repository pattern).
- **Models** (`models/*`): SQLAlchemy 2.0 typed models with mixins.

## Data model (key tables)

`users` · `subscriptions` · `payments` · `coupons` · `games` · `analyses` ·
`move_evaluations` · `puzzles` · `puzzle_attempts` · `opening_lessons` ·
`ai_explanations` · `rating_history` · `leaderboard_entries`.

## Async + background work

API is fully async (FastAPI + async SQLAlchemy + asyncpg). Expensive jobs
(full multi-depth game reviews, leaderboard snapshots, daily puzzle rotation)
run in **Celery** workers backed by Redis, scheduled via Celery beat.

## Cost & performance controls

1. **Redis hot cache** + **Postgres durable cache** for AI explanations.
2. Free-plan **daily quota** enforced in Redis.
3. Per-IP **rate limiting** (slowapi).
4. Game review only calls the LLM for *notable* moves (cpl ≥ threshold).
5. Engine results are evaluated at a configurable depth.

## Graceful degradation

No Stockfish → material heuristic. No OpenAI key → Malayalam template engine.
This keeps local dev and CI green without external dependencies.

## Frontend

Next.js App Router (server components for static/SEO pages, client components
for interactive board). Typed `lib/api.ts` client, Zustand auth store
(localStorage-persisted JWT), Tailwind design system with a Malayalam font
stack (`Noto Sans Malayalam`) and dark-mode-first theme.
