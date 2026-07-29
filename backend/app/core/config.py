from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "PPE Detection System"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    DEBUG: bool = True

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ppe_detection"
    AUTO_CREATE_TABLES: bool = True

    SECRET_KEY: str = "development-only-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:5173,"
        "http://localhost:5174"
    )

    BOOTSTRAP_ADMIN_EMAIL: str | None = None
    BOOTSTRAP_ADMIN_PASSWORD: str | None = None
    BOOTSTRAP_TOKEN: str | None = None
    ALLOW_PUBLIC_REGISTRATION: bool = False

    MODEL_PATH: str = "./yolo8s.pt"
    MODEL_VERSION: str = "sh17-yolov8s-baseline"
    MODEL_LICENSE_APPROVED: bool = False
    CONFIDENCE_THRESHOLD: float = 0.25
    PERSON_CONFIDENCE_THRESHOLD: float = 0.40

    UPLOAD_DIR: str = "./uploads"
    EVIDENCE_DIR: str = "./uploads/evidence"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024
    MAX_FRAME_SIZE: int = 10 * 1024 * 1024
    EVIDENCE_RETENTION_DAYS: int = 30
    METADATA_RETENTION_DAYS: int = 365

    CAMERA_ANALYSIS_FPS: float = 5.0
    CAMERA_RECONNECT_MAX_SECONDS: int = 30
    TEMPORAL_WINDOW_SIZE: int = 5
    TEMPORAL_CONFIRM_COUNT: int = 4
    TEMPORAL_CLEAR_COUNT: int = 3
    EVENT_COOLDOWN_SECONDS: int = 60
    VIDEO_FRAME_STRIDE: int = 5
    VIDEO_MAX_ANALYZED_FRAMES: int = 600
    EVIDENCE_PRE_SECONDS: int = 5
    EVIDENCE_POST_SECONDS: int = 10

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True
    ALERT_RECIPIENTS: str = ""

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def alert_recipients_list(self) -> list[str]:
        return [email.strip() for email in self.ALERT_RECIPIENTS.split(",") if email.strip()]

    @property
    def uploads_path(self) -> Path:
        return Path(self.UPLOAD_DIR).resolve()

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY == "development-only-secret-change-me" or len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be a unique value of at least 32 characters in production")
            if self.AUTO_CREATE_TABLES:
                raise ValueError("AUTO_CREATE_TABLES must be false in production; use Alembic migrations")
            if not self.MODEL_LICENSE_APPROVED:
                raise ValueError(
                    "MODEL_LICENSE_APPROVED must be true in production after the deployed "
                    "model, training data, and inference runtime have passed legal review"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
