import pytest
from fastapi.testclient import TestClient

from app import signals
from app.config import settings
from app.main import app


@pytest.fixture
def announced(monkeypatch):
    """Records announcements instead of sending them."""
    calls = []
    monkeypatch.setattr(signals, "announce_new_version", lambda: calls.append(True) or True)
    return calls


@pytest.fixture
def secret(monkeypatch):
    monkeypatch.setattr(settings, "release_secret", "let-me-in")
    return "let-me-in"


def test_the_release_password_announces_a_new_version(announced, secret):
    response = TestClient(app).post("/internal/app-updated", headers={"X-Release-Secret": secret})

    assert response.status_code == 204
    assert announced == [True]


@pytest.mark.parametrize("headers", [{}, {"X-Release-Secret": "guess"}])
def test_anyone_else_is_refused(announced, secret, headers):
    response = TestClient(app).post("/internal/app-updated", headers=headers)

    assert response.status_code == 403
    assert announced == []


def test_announcing_is_off_without_a_password(announced, monkeypatch):
    monkeypatch.setattr(settings, "release_secret", "")

    response = TestClient(app).post("/internal/app-updated", headers={"X-Release-Secret": ""})

    assert response.status_code == 403
    assert announced == []
