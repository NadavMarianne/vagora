"""Shared test helpers. Tests need a migrated database (`make migrate`)."""

from typing import Annotated

import pytest
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, bearer, get_firebase_user
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


def fake_firebase_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> FirebaseUser:
    """In tests, the login token is simply the Firebase user ID."""
    if credentials is None:
        raise HTTPException(401, "Not logged in.")
    uid = credentials.credentials
    return FirebaseUser(uid=uid, email=f"{uid}@example.com")


@pytest.fixture
def login_as(db):
    """Returns a function that gives a test client logged in as the given Firebase user.

    Each client sends its own token, so several people can be logged in during one test.
    """
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_firebase_user] = fake_firebase_user

    def make_client(uid: str = "uid-dana") -> TestClient:
        return TestClient(app, headers={"Authorization": f"Bearer {uid}"})

    yield make_client
    app.dependency_overrides.clear()


@pytest.fixture
def member(login_as):
    """Returns a function that gives a logged-in client with a set-up profile."""

    def make_member(username: str = "dana_k") -> TestClient:
        client = login_as(uid=f"uid-{username}")
        client.post("/me", json={"username": username, "display_name": username.title()})
        return client

    return make_member
