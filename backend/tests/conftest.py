"""Shared test helpers. Tests need a migrated database (`make migrate`)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, get_firebase_user
from app.db import engine, get_db
from app.main import app


@pytest.fixture
def db():
    """A database session whose changes are undone after each test."""
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        yield session
        session.close()
        transaction.rollback()


@pytest.fixture
def login_as(db):
    """Returns a function that gives a test client logged in as the given Firebase user."""

    def make_client(uid: str = "uid-dana", email: str = "dana@example.com") -> TestClient:
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_firebase_user] = lambda: FirebaseUser(uid=uid, email=email)
        return TestClient(app)

    yield make_client
    app.dependency_overrides.clear()
