from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.models import Order

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 100,
    "time_zone": "UTC",
}


@pytest.fixture
def home(member):
    """Dana and Noa in Dana's market. Returns (dana, noa, market_id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()
    noa.post(f"/invites/{invite['id']}/accept")
    return dana, noa, market_id


def messages(client):
    return [n["message"] for n in client.get("/notifications").json()]


def test_messages_are_kept(home):
    dana, noa, market_id = home

    # Noa was invited before joining; Dana heard Noa joined.
    assert messages(noa) == ["Dana_K invited you to Home"]
    assert messages(dana) == ["Noa_R joined Home"]
    saved = dana.get("/notifications").json()[0]
    assert saved["path"] == f"/markets/{market_id}"
    assert saved["read"] is False


def test_newest_first(home):
    dana, noa, market_id = home
    noa.patch(f"/markets/{market_id}", json={"name": "Home 2"})
    dana.post(
        f"/markets/{market_id}/products",
        json={"name": "Tea", "coin_mode": "vanish", "price": 5, "sellers": ["noa_r"]},
    )

    assert messages(noa)[0] == "Dana_K asks you to sell Tea"


def test_read_one_and_all(home):
    dana, noa, market_id = home
    dana.post(
        f"/markets/{market_id}/products",
        json={"name": "Tea", "coin_mode": "vanish", "price": 5, "sellers": ["noa_r"]},
    )
    first, second = noa.get("/notifications").json()

    assert noa.post(f"/notifications/{first['id']}/read").status_code == 204
    assert [n["read"] for n in noa.get("/notifications").json()] == [True, False]

    assert noa.post("/notifications/read-all").status_code == 204
    assert all(n["read"] for n in noa.get("/notifications").json())
    assert second


def test_dismiss_one_and_all(home):
    dana, noa, market_id = home
    dana.post(
        f"/markets/{market_id}/products",
        json={"name": "Tea", "coin_mode": "vanish", "price": 5, "sellers": ["noa_r"]},
    )
    first = noa.get("/notifications").json()[0]

    assert noa.delete(f"/notifications/{first['id']}").status_code == 204
    assert messages(noa) == ["Dana_K invited you to Home"]
    assert noa.delete("/notifications").status_code == 204
    assert messages(noa) == []


def test_only_your_own(home):
    dana, noa, _ = home
    danas = dana.get("/notifications").json()[0]

    assert noa.post(f"/notifications/{danas['id']}/read").status_code == 404
    noa.delete(f"/notifications/{danas['id']}")
    assert messages(dana) == ["Noa_R joined Home"]


def test_news_from_while_away_is_waiting(home, db):
    """A deadline that ran out while both apps were closed is in the list once anyone opens it."""
    dana, noa, market_id = home
    product = dana.post(
        f"/markets/{market_id}/products",
        json={"name": "Tea", "coin_mode": "vanish", "price": 5, "sellers": ["noa_r"]},
    ).json()
    proposal = noa.get(f"/markets/{market_id}/proposals").json()[0]
    terms = {"delivery": "deadline", "duration_seconds": 3600, "refundable": True}
    noa.post(f"/markets/{market_id}/proposals/{proposal['id']}/accept", json=terms)
    offer = dana.get(f"/markets/{market_id}/products/{product['id']}").json()["offers"][0]
    dana.post(f"/markets/{market_id}/offers/{offer['id']}/buy")
    db.execute(update(Order).values(due_at=datetime.now(UTC) - timedelta(seconds=1)))

    # Opening the app loads your markets, which catches them up.
    dana.get("/markets")

    assert "The deadline for Tea passed" in messages(dana)
    assert "You missed the deadline for Tea" in messages(noa)
