"""FastAPI application entrypoint for CheckMate Malayalam AI."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app import __version__
from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.services.stockfish_service import stockfish_service

configure_logging()
logger = get_logger(__name__)

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("app.startup", project=settings.PROJECT_NAME, version=__version__)
    yield
    await stockfish_service.close()
    logger.info("app.shutdown")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=__version__,
    description="AI-powered chess teacher for Malayalam speakers.",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", path=request.url.path, error=str(exc))
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in settings.cors_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )


app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {"name": settings.PROJECT_NAME, "version": __version__, "docs": "/docs"}
