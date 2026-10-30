from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app import db
from app.main import app

client = TestClient(app)


def test_health_checks_the_database():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_an_unreachable_database(monkeypatch):
    # Nothing listens on port 1, so connecting fails right away.
    unreachable = create_engine("postgresql+psycopg://x:x@127.0.0.1:1/x")
    monkeypatch.setattr(db, "engine", unreachable)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "error", "database": "unreachable"}
