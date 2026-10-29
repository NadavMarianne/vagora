from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings, read from environment variables (for example DATABASE_URL)."""

    database_url: str = "postgresql+psycopg://vagora:vagora@localhost:5432/vagora"
    firebase_project_id: str = "vagora-dev"


settings = Settings()
