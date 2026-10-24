import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.audit import router as audit_router
from backend.app.api.guidelines import router as guidelines_router
from backend.app.api.health import router as health_router
from backend.app.core.config import settings
from backend.app.core.lifespan import lifespan

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("brandguard")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    description="BrandGuard - Enterprise Brand Compliance and Coaching Platform API",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware for Next.js frontend communication (supports localhost, Vercel deployments, and custom domains)
allowed_origins_list = [
    origin.strip()
    for origin in settings.ALLOWED_ORIGINS.split(",")
    if origin.strip()
]
is_wildcard = "*" in allowed_origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else allowed_origins_list,
    allow_origin_regex=None if is_wildcard else r"^https://.*\.vercel\.app$",
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(health_router)                              # GET /health  (root, for backward compat)
app.include_router(health_router, prefix="/api")              # GET /api/health (via apiFetch base path)
app.include_router(guidelines_router, prefix="/api/guidelines")
app.include_router(audit_router, prefix="/api/audit")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

