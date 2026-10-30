from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings, read from environment variables (for example DATABASE_URL)."""

    database_url: str = "postgresql+psycopg://vagora:vagora@localhost:5432/vagora"
    firebase_project_id: str = "vagora-dev"
    # The Firestore-only key for live updates, as JSON. Secret: set only in Vercel, never in Git.
    # Empty means live updates are off (tests and local development).
    firebase_service_account: str = ""

    @field_validator("database_url")
    @classmethod
    def use_psycopg(cls, url: str) -> str:
        """Hosts like Neon give plain "postgresql://" addresses. This tells SQLAlchemy which
        driver to use, so the address can be pasted in as the host gives it."""
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url


settings = Settings()
