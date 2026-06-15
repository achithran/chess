# ♟️ CheckMate Malayalam AI

> **മലയാളത്തിൽ ഒരു AI ചെസ് അധ്യാപകൻ** — an AI-powered chess learning platform
> built for Malayalam-speaking students, beginners, and casual players.

CheckMate analyses your moves with **Stockfish**, then explains *why* a move is
good or bad in **simple Malayalam** using an OpenAI-backed explanation pipeline
(with deterministic offline fallback). Play vs adaptive AI, solve daily puzzles,
train openings, review your games, and climb the Kerala leaderboard.

---

## ✨ Features

| Area | What it does |
|------|--------------|
| **AI Analysis** | Best move, evaluation bar, centipawn loss, blunder detection |
| **Malayalam AI** | Move explanations in simple Malayalam (beginner → advanced) |
| **Play vs AI** | 4 difficulty levels via Stockfish *Skill Level* |
| **Puzzle Trainer** | Daily puzzles, themes, Elo-style puzzle rating, streaks |
| **Opening Trainer** | Italian, Sicilian, London — Malayalam ideas & explanations |
| **Game Review** | PGN upload → accuracy %, blunder count, Malayalam summary |
| **Leaderboard** | Kerala + global rankings by puzzle rating & streak |
| **Dashboard** | Rating progression, insights, AI recommendations |
| **Subscriptions** | Free vs Pro (Razorpay/Stripe ready), coupons, referrals |

---

## 🏗️ Architecture

```
chess/
├── backend/                 FastAPI + SQLAlchemy (async) + Celery
│   └── app/
│       ├── core/            config, security (JWT/bcrypt), logging
│       ├── db/              async engine, session, redis, init/seed
│       ├── models/          SQLAlchemy models (users, games, puzzles, …)
│       ├── schemas/         Pydantic request/response models
│       ├── repositories/    data-access layer (repository pattern)
│       ├── services/        Stockfish, AI explanation, analysis, auth
│       ├── api/             routers + shared deps (auth, quota, rate limit)
│       └── workers/         Celery app + background tasks
├── frontend/                Next.js 15 (App Router) + TS + Tailwind
│   └── src/
│       ├── app/             routes: /, /play, /puzzles, /openings, /review …
│       ├── components/      board, eval bar, explanation, navbar
│       ├── lib/             typed API client
│       └── store/           Zustand auth store
├── k8s/                     Kubernetes manifests
├── .github/workflows/       CI (tests, typecheck, docker build)
└── docker-compose.yml       db + redis + backend + worker + frontend
```

**Design principles:** clean/modular layers, repository + service patterns,
fully async APIs, graceful degradation (works without Stockfish/OpenAI),
structured logging, multi-layer caching for AI cost control.

---

## 🚀 Quick start (Docker)

```bash
cp .env.example .env          # fill in OPENAI_API_KEY etc. (optional for demo)
docker compose up --build
```

Then in another shell, create tables + seed demo content:

```bash
docker compose exec backend python -m app.db.init_db
```

- Frontend → http://localhost:3000
- API docs (Swagger) → http://localhost:8000/docs
- Seeded admin → `admin@checkmate.ai` / `admin12345`

> Stockfish and OpenAI are **optional**: the backend falls back to a material
> heuristic + a deterministic Malayalam template engine, so everything runs in
> CI and offline. Add `OPENAI_API_KEY` for full LLM explanations.

---

## 🧑‍💻 Local development (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.db.init_db          # needs Postgres + Redis running
uvicorn app.main:app --reload
pytest tests/test_chess_logic.py  # engine-independent tests
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Security

JWT access + refresh tokens · bcrypt password hashing · per-IP rate limiting
(slowapi) · per-user daily quota (Redis) · CORS allow-list · parameterised
SQLAlchemy queries (no raw SQL) · all secrets via environment variables.

---

## 💳 Monetization

Free plan (capped daily analyses) and Pro plan (unlimited + voice + courses).
Razorpay & Stripe checkout endpoints are scaffolded in
`api/routers/subscriptions.py`; wire the real SDK + verify webhooks server-side
before activating subscriptions. Coupons & referral codes are modelled.

---

## 📦 Deployment

- **Docker Compose** for single-host / Railway / Render.
- **Kubernetes** manifests in `k8s/` (Deployments, Services, Secrets) for
  AWS/GKE/EKS. Use managed Postgres + Redis in production.
- **Frontend** deploys to Vercel (set `NEXT_PUBLIC_API_URL`); backend image is
  `output: standalone`-compatible.

See [`docs/API.md`](docs/API.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for endpoint and design details.

---

## 🗺️ Roadmap

Voice explanations · AI chess coach chat · realtime multiplayer · video lessons
· live tournaments · Malayalam YouTube integration.

## 📄 License

MIT (see `LICENSE`).
