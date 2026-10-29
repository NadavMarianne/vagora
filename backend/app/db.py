from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# pool_pre_ping checks a connection before using it, so a database that went to sleep
# or restarted doesn't cause errors.
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Parent class for all database tables."""


def get_db() -> Iterator[Session]:
    """Gives each request its own database session and closes it afterwards."""
    with SessionLocal() as session:
        yield session
