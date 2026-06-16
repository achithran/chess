"""Create tables and seed starter content.

For production use Alembic migrations (``alembic/`` is scaffolded). This module
gives a one-command bootstrap for local dev:

    python -m app.db.init_db
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.logging import configure_logging, get_logger
from app.core.security import hash_password
from app.data.puzzle_seed_data import PUZZLES
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.opening import OpeningLesson
from app.models.puzzle import Puzzle
from app.models.user import SubscriptionPlan, User

logger = get_logger(__name__)


SEED_OPENINGS = [
    OpeningLesson(
        name="Italian Game",
        slug="italian-game",
        eco="C50",
        moves=["e4", "e5", "Nf3", "Nc6", "Bc4"],
        difficulty=1,
        description_ml=(
            "ഇറ്റാലിയൻ ഗെയിം തുടക്കക്കാർക്ക് ഏറ്റവും അനുയോജ്യമായ ഓപ്പണിംഗ് ആണ്. "
            "ആനയെ c4-ലേക്ക് കൊണ്ടുവന്ന് f7 കളത്തിൽ സമ്മർദ്ദം ചെലുത്തുന്നു."
        ),
        ideas_ml="വേഗത്തിലുള്ള വികസനം, കേന്ദ്ര നിയന്ത്രണം, രാജാവിന്റെ കാസ്ലിംഗ്.",
    ),
    OpeningLesson(
        name="Sicilian Defense",
        slug="sicilian-defense",
        eco="B20",
        moves=["e4", "c5"],
        difficulty=3,
        description_ml=(
            "സിസിലിയൻ ഡിഫൻസ് കറുപ്പിന്റെ ഏറ്റവും ജനപ്രിയമായ പ്രതിരോധമാണ്. "
            "ഇത് അസമമായ ഘടന സൃഷ്ടിച്ച് കറുപ്പിന് വിജയസാധ്യത നൽകുന്നു."
        ),
        ideas_ml="കേന്ദ്രത്തിൽ പോരാട്ടം, c-ഫയൽ നിയന്ത്രണം, പ്രതിയാക്രമണം.",
    ),
    OpeningLesson(
        name="London System",
        slug="london-system",
        eco="D02",
        moves=["d4", "d5", "Nf3", "Nf6", "Bf4"],
        difficulty=2,
        description_ml=(
            "ലണ്ടൻ സിസ്റ്റം പഠിക്കാൻ എളുപ്പമുള്ള ഒരു ഖര ഓപ്പണിംഗ് ആണ്. "
            "ആനയെ f4-ലേക്ക് നേരത്തെ വികസിപ്പിക്കുന്നു."
        ),
        ideas_ml="ഉറച്ച ഘടന, എളുപ്പമുള്ള പ്ലാൻ, കുറഞ്ഞ തിയറി.",
    ),
]

def _build_seed_puzzles() -> list[Puzzle]:
    puzzles = []
    for i, p in enumerate(PUZZLES):
        puzzles.append(
            Puzzle(
                fen=p["fen"],
                moves=p["moves"],
                rating=p["rating"],
                themes=p["themes"],
                hints=p["hints"],
                is_daily=(i == 0),
            )
        )
    return puzzles


SEED_PUZZLES = _build_seed_puzzles()


async def init_models() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Admin user
        if not (await db.execute(select(User).where(User.email == "admin@checkmate.ai"))).scalar_one_or_none():
            db.add(
                User(
                    email="admin@checkmate.ai",
                    full_name="Admin",
                    hashed_password=hash_password("admin12345"),
                    is_admin=True,
                    is_verified=True,
                    plan=SubscriptionPlan.PRO,
                    referral_code="ADMIN1",
                )
            )

        if not (await db.execute(select(OpeningLesson))).scalars().first():
            db.add_all(SEED_OPENINGS)
        if not (await db.execute(select(Puzzle))).scalars().first():
            db.add_all(SEED_PUZZLES)

        await db.commit()
    logger.info("db.seeded")


async def main() -> None:
    configure_logging()
    await init_models()
    await seed()


if __name__ == "__main__":
    asyncio.run(main())
