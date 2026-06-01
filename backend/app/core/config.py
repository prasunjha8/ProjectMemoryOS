from typing import Any, Dict, List, Optional
import os
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_disable_local_embeddings() -> bool:
    # Auto-detect running on cloud instances like Railway, Render, etc.
    is_cloud = any(k.startswith("RAILWAY_") or k.startswith("RENDER_") or "VERCEL" in k for k in os.environ)
    
    # Auto-detect low memory container environment (Linux /proc/meminfo < 1.2GB)
    is_low_mem = False
    try:
        if os.path.exists("/proc/meminfo"):
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        mem_kb = int(line.split()[1])
                        if mem_kb < 1200000:
                            is_low_mem = True
                            break
    except Exception:
        pass
    
    return is_cloud or is_low_mem


class Settings(BaseSettings):
    PROJECT_NAME: str = "Project Memory OS"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development", validation_alias="ENVIRONMENT")

    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        validation_alias="DATABASE_URL"
    )
    DATABASE_POOL_SIZE: int = Field(default=10, validation_alias="DATABASE_POOL_SIZE")
    DATABASE_MAX_OVERFLOW: int = Field(default=10, validation_alias="DATABASE_MAX_OVERFLOW")
    DATABASE_POOL_RECYCLE: int = Field(default=1800, validation_alias="DATABASE_POOL_RECYCLE")
    
    # Supabase JWT configurations for token authentication
    SUPABASE_URL: str = Field(default="https://example.supabase.co", validation_alias="SUPABASE_URL")
    SUPABASE_JWT_SECRET: str = Field(default="placeholder_secret", validation_alias="SUPABASE_JWT_SECRET")

    # LLM Settings (OpenRouter)
    OPENROUTER_API_KEY: Optional[str] = Field(default=None, validation_alias="OPENROUTER_API_KEY")
    OPENROUTER_MODEL: str = Field(default="google/gemini-2.5-flash", validation_alias="OPENROUTER_MODEL")

    # Embeddings configuration
    DISABLE_LOCAL_EMBEDDINGS: bool = Field(
        default_factory=_default_disable_local_embeddings,
        validation_alias="DISABLE_LOCAL_EMBEDDINGS"
    )
    HF_API_TOKEN: Optional[str] = Field(default=None, validation_alias="HF_API_TOKEN")

    # Observability & Security Settings
    SENTRY_DSN: Optional[str] = Field(default=None, validation_alias="SENTRY_DSN")
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, validation_alias="RATE_LIMIT_PER_MINUTE")
    ALLOWED_ORIGINS: Any = Field(
        default=["*", "http://localhost:3000", "https://project-memory-os-chi.vercel.app"],
        validation_alias="ALLOWED_ORIGINS"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Any) -> Any:
        if isinstance(v, str):
            # Check if the protocol is already standard postgres and transform to asyncpg
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> Any:
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
