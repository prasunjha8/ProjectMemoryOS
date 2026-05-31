import os
import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import settings
from app.api.router import api_router
from app.core.database import get_db
# Import models to register them in SQLAlchemy metadata
import app.models

# 1. Boot-time Environment Validation
from app.core.env_validator import validate_environment
validate_environment()

# 2. Structured Logging Configuration
from app.core.logging_config import configure_logging, RequestLoggingMiddleware
configure_logging()

# 3. Initialize Sentry (if DSN configured)
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastAPIIntegration
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[FastAPIIntegration()],
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,  # Sample 10% of transactions in production
        )
    except Exception as e:
        import logging
        logging.getLogger("app.diagnostics").error(f"Failed to initialize Sentry SDK: {str(e)}")

# 4. Initialize SlowAPI Rate Limiter
from app.api.middleware import limiter, ContentLengthLimitMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-grade AI workspace to summarize chats, extract tasks, and query memories.",
    version="1.0.0",
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
    openapi_url=None if settings.ENVIRONMENT == "production" else f"{settings.API_V1_STR}/openapi.json",
)

# Attach rate limiter to app state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 5. Mount Global Request Interceptors & Security Middlewares
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(ContentLengthLimitMiddleware)

# Configure CORS origins based on settings (strict list in production, wildcard in development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount our v1 API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "status": "online",
        "docs": "disabled" if settings.ENVIRONMENT == "production" else "/docs"
    }


@app.get(f"{settings.API_V1_STR}/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint that runs diagnostics on the database connection
    and reports the status of the local SentenceTransformers embedding model.
    """
    health_status = {
        "status": "healthy",
        "database": "connected",
        "embeddings_model": "unloaded"
    }
    
    # 1. Verify PostgreSQL Database connection health
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["database"] = f"disconnected: {str(e)}"
        
    # 2. Check Embedding Model status
    try:
        import app.services.embedding_service as emb_svc
        if emb_svc._model is not None:
            health_status["embeddings_model"] = "loaded"
        else:
            health_status["embeddings_model"] = "ready_on_demand"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["embeddings_model"] = f"error: {str(e)}"
        
    return health_status


if __name__ == "__main__":
    # Disable reload in production to conserve resources and run efficiently
    reload_mode = settings.ENVIRONMENT != "production"
    port_env = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port_env,
        reload=reload_mode,
    )
