from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    PROJECT_NAME: str = "PPE Detection System"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True
    
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ppe_detection"
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    MODEL_PATH: str = "./app/ml/models/ppe_yolov8n.pt"
    CONFIDENCE_THRESHOLD: float = 0.5
    
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()