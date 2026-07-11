import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env" if os.getenv("VERCEL") != "1" else None,
        extra="ignore",
    )

    APP_NAME: str = "Internal Work Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./workmanager.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if isinstance(value, str):
            if value.startswith("postgres://"):
                value = value.replace("postgres://", "postgresql://", 1)
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

    BLOB_READ_WRITE_TOKEN: str | None = None

    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    GOOGLE_MEET_URL: str = "https://meet.google.com/mvs-btmd-bby"
    MEETING_TIMEZONE: str = "Asia/Kolkata"
    MEET_POOL_AUTO_RELEASE_MINUTES: int = 60
    TASK_CALL_BUFFER_MINUTES: int = 5

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
