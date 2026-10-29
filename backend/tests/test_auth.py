from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from firebase_admin import auth

from app import auth as app_auth
from app.auth import FirebaseUser, get_firebase_user

# A tiny app with one protected endpoint, just for these tests.
protected_app = FastAPI()


@protected_app.get("/protected")
def protected(user: Annotated[FirebaseUser, Depends(get_firebase_user)]) -> dict[str, str | None]:
    return {"uid": user.uid, "email": user.email}


client = TestClient(protected_app)

GOOD_CLAIMS = {"uid": "abc123", "email": "dana@example.com", "email_verified": True}


@pytest.fixture
def fake_firebase(monkeypatch):
    """Replaces the real token check. Set `.result` to claims or an exception."""

    class Fake:
        result: dict | Exception = GOOD_CLAIMS

        def verify(self, token: str) -> dict:
            if isinstance(self.result, Exception):
                raise self.result
            return self.result

    fake = Fake()
    monkeypatch.setattr(app_auth, "verify_token", fake.verify)
    return fake


def get_with_token(token: str = "some-token"):
    return client.get("/protected", headers={"Authorization": f"Bearer {token}"})


def test_valid_token_is_accepted(fake_firebase):
    response = get_with_token()

    assert response.status_code == 200
    assert response.json() == {"uid": "abc123", "email": "dana@example.com"}


def test_missing_token_is_refused(fake_firebase):
    response = client.get("/protected")

    assert response.status_code == 401


def test_invalid_token_is_refused(fake_firebase):
    fake_firebase.result = auth.InvalidIdTokenError("bad signature")

    assert get_with_token().status_code == 401


def test_expired_token_is_refused(fake_firebase):
    fake_firebase.result = auth.ExpiredIdTokenError("expired", cause=None)

    assert get_with_token().status_code == 401


def test_unverified_email_is_refused(fake_firebase):
    fake_firebase.result = {**GOOD_CLAIMS, "email_verified": False}

    response = get_with_token()

    assert response.status_code == 403
    assert response.json()["detail"] == "Please verify your email first."


def test_real_checker_starts_without_a_secret_key():
    # Uses the real Firebase check. A malformed token is rejected before any network call.
    with pytest.raises(auth.InvalidIdTokenError):
        app_auth.verify_token("not-a-token")


def test_firebase_unreachable_says_try_again(fake_firebase):
    fake_firebase.result = auth.CertificateFetchError("no network", cause=None)

    assert get_with_token().status_code == 503
