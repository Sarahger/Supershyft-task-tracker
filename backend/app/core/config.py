from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Internal Work Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./workmanager.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Neon and others may return postgres:// — SQLAlchemy expects postgresql://
        if isinstance(value, str):
            if value.startswith("postgres://"):
                value = value.replace("postgres://", "postgresql://", 1)
            # channel_binding can break psycopg2 on some serverless runtimes
            value = value.replace("channel_binding=require&", "").replace("&channel_binding=require", "")
            value = value.replace("?channel_binding=require", "")
        return value

    SECRET_KEY: str = "change-this-secret-key-in-production-use-env-var"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@company.com"
    SMTP_TLS: bool = True
    EMAIL_ENABLED: bool = False

    FRONTEND_URL: str = "http://localhost:5173"
    AUTO_SEED: bool = True

    # Vercel Blob (auto-injected when Blob store is linked to the project)
    BLOB_READ_WRITE_TOKEN: str | None = None

    # Stored as comma-separated string — pydantic-settings JSON-parses list fields from .env
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
