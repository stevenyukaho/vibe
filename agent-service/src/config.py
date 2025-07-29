from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Model Provider Settings
    MODEL_PROVIDER_URL: Optional[str] = None
    MODEL_PROVIDER_API_KEY: Optional[str] = None
    
    # Service Settings
    PORT: int = 5002
    HOST: str = "0.0.0.0"
    
    # Optional Tool API Keys
    OTHER_TOOL_API_KEYS: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
