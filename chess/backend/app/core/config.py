"""Application configuration loaded from environment variables.

Uses pydantic-settings so every value is validated and typed. Import the
singleton ``settings`` everywhere instead of reading ``os.environ`` directly.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ---- General ----
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "CheckMate Malayalam AI"
    API_V1_PREFIX: str = "/api/v1"

    # ---- Security ----
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Comma-separated list of allowed origins (parsed via the cors_origins
    # property). Kept as a plain str so pydantic-settings does not try to
    # JSON-decode the env value.
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"

    # ---- Database ----
    DATABASE_URL: str = (
        "postgresql+asyncpg://checkmate:checkmate@localhost:5432/checkmate"
    )

    # ---- Redis ----
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ---- Stockfish ----
    STOCKFISH_PATH: str = "/usr/games/stockfish"
    STOCKFISH_DEPTH: int = 15
    STOCKFISH_THREADS: int = 2
    STOCKFISH_HASH_MB: int = 128

    # ---- OpenAI ----
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    AI_EXPLANATION_CACHE_TTL: int = 60 * 60 * 24 * 30  # 30 days

    # ---- Groq / Llama (free fallback) ----
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ---- Ollama (local LLM for Malayalam) ----
    OLLAMA_URL:   str = "http://ollama:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"

    # ---- ElevenLabs TTS ----
    ELEVENLABS_API_KEY: str = ""

    # ---- OAuth ----
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ---- Payments ----
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # ---- Limits ----
    RATE_LIMIT_PER_MINUTE: int = 60
    FREE_PLAN_DAILY_ANALYSES: int = 10
    FREE_PLAN_DAILY_HINTS: int = 3

    @property
    def cors_origins(self) -> list[str]:
        """Allowed CORS origins as a list, from the comma-separated setting."""
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
