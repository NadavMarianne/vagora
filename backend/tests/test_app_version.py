import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture
def minimum(monkeypatch):
    monkeypatch.setattr(settings, "min_app_version", 3)
    monkeypatch.setattr(settings, "apk_url", "https://example.com/vagora.apk")


@pytest.mark.parametrize("headers", [{}, {"X-App-Version": "2"}, {"X-App-Version": "junk"}])
def test_an_app_older_than_the_minimum_is_asked_to_update(minimum, headers):
    response = TestClient(app).get("/me", headers=headers)

    assert response.status_code == 426
    assert response.json() == {
        "detail": "This version of vagora is too old. Please update.",
        "apk_url": "https://example.com/vagora.apk",
    }


@pytest.mark.parametrize("version", ["3", "4"])
def test_an_app_at_the_minimum_or_newer_goes_through(minimum, version):
    response = TestClient(app).get("/me", headers={"X-App-Version": version})

    # Not logged in, but past the version check.
    assert response.status_code == 401


def test_by_default_every_app_goes_through():
    response = TestClient(app).get("/me")

    assert response.status_code == 401


def test_without_a_download_link_the_app_gets_none(minimum, monkeypatch):
    monkeypatch.setattr(settings, "apk_url", "")

    response = TestClient(app).get("/me")

    assert response.json()["apk_url"] is None


def test_release_calls_skip_the_check(minimum):
    response = TestClient(app).post("/internal/app-updated")

    assert response.status_code == 403
