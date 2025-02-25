from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Model Provider Settings
    MODEL_PROVIDER_URL: Optional[str] = None
    MODEL_PROVIDER_API_KEY: str

    # Service Settings
    PORT: int = 5001
    HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "INFO"

    # Optional API Keys
    SERPER_API_KEY: Optional[str] = None
    BROWSERLESS_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
