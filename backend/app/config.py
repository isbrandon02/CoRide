from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Relative paths are resolved to backend/data/ at runtime (see database.py).
    DATABASE_URL: str = "sqlite:///./data/coride.db"

    # Insert demo users from data/demo_accounts.json on startup (idempotent). Set false in production.
    SEED_DEMO_ACCOUNTS: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
