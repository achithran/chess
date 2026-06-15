from __future__ import annotations

from pydantic import BaseModel


class Message(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str
    version: str
    engine_available: bool
    ai_enabled: bool
