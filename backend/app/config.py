from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings, read from environment variables (for example DATABASE_URL)."""

    database_url: str = "postgresql+psycopg://vagora:vagora@localhost:5432/vagora"
    firebase_project_id: str = "vagora-dev"
    # The Firestore-only key for live updates, as JSON. Secret: set only in Vercel, never in Git.
    # Empty means live updates are off (tests and local development).
    firebase_service_account: str = ""
    # The password GitHub uses to announce a new app version (decision 0029). Secret: set only in
    # Vercel and in GitHub, never in Git. Empty means announcing is off.
    release_secret: str = ""
    # The oldest app version that still works with this backend (decision 0029). Older apps are
    # asked to update. Raised only when a change can't keep older apps working; 0 lets all in.
    min_app_version: int = 0
    # Where to download the newest APK, for an app too old to update over the air. Empty means
    # the app tells the person to ask for the new version.
    apk_url: str = ""

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
