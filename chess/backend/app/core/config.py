"""Application configuration loaded from environment variables.

Uses pydantic-settings so every value is validated and typed. Import the
singleton ``settings`` everywhere instead of reading ``os.environ`` directly.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator, model_validator
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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours — enough for a full session
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
    # Celery URLs default to REDIS_URL if not set explicitly
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _fix_db_driver(cls, v: str) -> str:
        """Railway Postgres gives postgresql:// — asyncpg needs postgresql+asyncpg://."""
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @model_validator(mode="after")
    def _set_celery_defaults(self) -> "Settings":
        """Fall back to REDIS_URL for Celery if explicit broker/backend not set."""
        if not self.CELERY_BROKER_URL:
            object.__setattr__(self, "CELERY_BROKER_URL", self.REDIS_URL)
        if not self.CELERY_RESULT_BACKEND:
            object.__setattr__(self, "CELERY_RESULT_BACKEND", self.REDIS_URL)
        return self

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

    # ---- Google Cloud TTS (preferred for Indian languages — native Wavenet voices) ----
    # Get from Google Cloud Console → APIs & Services → Credentials → API key
    # Enable "Cloud Text-to-Speech API" for the project first.
    GOOGLE_TTS_API_KEY: str = ""

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
