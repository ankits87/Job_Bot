from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379/0"

    # LinkedIn OAuth credentials are NOT stored here.
    # They are entered via the /setup UI and stored encrypted in the DB.

    groq_api_key: str
    gemini_api_key: str

    # Used to derive the encryption key for secrets stored in the DB.
    secret_key: str

    frontend_url: str = "http://localhost:5173"
    environment: str = "development"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
