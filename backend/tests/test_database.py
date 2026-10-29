from sqlalchemy import text

from app.db import engine


def test_database_answers():
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
