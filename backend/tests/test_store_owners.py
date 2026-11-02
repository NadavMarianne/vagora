from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.models import ProductRequest

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 100,
    "time_zone": "Asia/Jerusalem",
}

TERMS = {"delivery": "deadline", "duration_seconds": 3 * 24 * 3600, "refundable": True}


@pytest.fixture
def home(member):
    """Dana, Noa and Tal in Dana's market, and a product Dana created that Noa sells.

    Returns (dana, noa, tal, market_id, product_path).
    """
    dana, noa, tal = member("dana_k"), member("noa_r"), member("tal_b")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    for client, username in ((noa, "noa_r"), (tal, "tal_b")):
        invite = dana.post(f"/markets/{market_id}/invites", json={"username": username}).json()
        client.post(f"/invites/{invite['id']}/accept")
    product = dana.post(
        f"/markets/{market_id}/products",
        json={"name": "Massage", "coin_mode": "to_seller", "price": 30, "sellers": ["noa_r"]},
    ).json()
    proposal = noa.get(f"/markets/{market_id}/proposals").json()[0]
    noa.post(f"/markets/{market_id}/proposals/{proposal['id']}/accept", json=TERMS)
    return dana, noa, tal, market_id, f"/markets/{market_id}/products/{product['id']}"


def requests_of(client, path):
    return client.get(path).json()["requests"]


def answer(client, market_id, request_id, how):
    return client.post(f"/markets/{market_id}/product-requests/{request_id}/{how}")


def make_co_owner(home, client, username):
    """Dana invites someone to co-own; they accept."""
    dana, _, _, market_id, path = home
    dana.post(f"{path}/owners", json={"username": username})
    request_id = requests_of(client, path)[0]["id"]
    return answer(client, market_id, request_id, "approve")


def owners(client, path):
    return [o["username"] for o in client.get(path).json()["owners"]]


def test_creator_is_the_first_owner(home):
    dana, noa, _, _, path = home

    assert owners(dana, path) == ["dana_k"]
    assert dana.get(path).json()["is_mine"] is True
    assert noa.get(path).json()["is_mine"] is False


def test_single_owner_changes_at_once(home):
    dana, _, _, _, path = home

    changed = dana.patch(path, json={"name": "Back rub"}).json()

    assert changed["name"] == "Back rub"
    assert changed["requests"] == []


def test_co_owner_must_accept(home):
    dana, _, tal, market_id, path = home
    dana.post(f"{path}/owners", json={"username": "tal_b"})

    waiting = tal.get(f"/markets/{market_id}/product-requests").json()
    assert [(r["kind"], r["product_name"]) for r in waiting] == [("add_owner", "Massage")]
    assert waiting[0]["asks_you_to_own"] is True
    assert owners(dana, path) == ["dana_k"]

    assert answer(tal, market_id, waiting[0]["id"], "approve").status_code == 200
    assert owners(dana, path) == ["dana_k", "tal_b"]


def test_co_owner_can_decline(home):
    dana, _, tal, market_id, path = home
    dana.post(f"{path}/owners", json={"username": "tal_b"})
    request_id = requests_of(tal, path)[0]["id"]

    answer(tal, market_id, request_id, "decline")

    assert owners(dana, path) == ["dana_k"]
    assert requests_of(dana, path) == []


def test_changes_need_every_owner(home):
    dana, _, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")

    asked = dana.patch(path, json={"name": "Back rub"}).json()
    assert asked["name"] == "Massage"
    request = asked["requests"][0]
    assert [p["username"] for p in request["waiting_for"]] == ["tal_b"]
    assert request["mine"] is True

    approved = answer(tal, market_id, request["id"], "approve").json()
    assert approved["name"] == "Back rub"


def test_any_decline_cancels(home):
    dana, _, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    request_id = dana.post(f"{path}/close").json()["requests"][0]["id"]

    answer(tal, market_id, request_id, "decline")

    assert dana.get(path).json()["status"] == "live"


def test_closing_with_co_owners(home):
    dana, _, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    request_id = dana.post(f"{path}/close").json()["requests"][0]["id"]

    assert dana.post(f"{path}/close").status_code == 409  # already waiting
    answer(tal, market_id, request_id, "approve")

    assert dana.get(path).json()["status"] == "closed"


def test_adding_needs_existing_owners_too(home, member):
    dana, noa, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")

    dana.post(f"{path}/owners", json={"username": "noa_r"})
    request_id = requests_of(noa, path)[0]["id"]
    answer(noa, market_id, request_id, "approve")
    assert owners(dana, path) == ["dana_k", "tal_b"]  # still waiting for Tal

    answer(tal, market_id, request_id, "approve")
    assert owners(dana, path) == ["dana_k", "tal_b", "noa_r"]


def test_only_people_it_waits_for_answer(home):
    dana, noa, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    request_id = dana.patch(path, json={"name": "X"}).json()["requests"][0]["id"]

    assert answer(noa, market_id, request_id, "approve").status_code == 403
    assert answer(dana, market_id, request_id, "approve").status_code == 403  # already did


def test_requests_expire(home, db):
    dana, _, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    dana.patch(path, json={"name": "X", "expires_in_seconds": 10})
    db.execute(update(ProductRequest).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))

    assert requests_of(dana, path) == []
    assert dana.get(path).json()["name"] == "Massage"


def test_request_expiry_limits(home):
    dana, _, _, _, path = home

    assert dana.patch(path, json={"name": "X", "expires_in_seconds": 9}).status_code == 422
    too_long = 30 * 24 * 3600 + 1
    assert dana.patch(path, json={"name": "X", "expires_in_seconds": too_long}).status_code == 422


def test_asker_can_cancel(home):
    dana, _, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    request_id = dana.patch(path, json={"name": "X"}).json()["requests"][0]["id"]

    assert tal.delete(f"/markets/{market_id}/product-requests/{request_id}").status_code == 403
    assert dana.delete(f"/markets/{market_id}/product-requests/{request_id}").status_code == 200
    assert requests_of(tal, path) == []


def test_removing_needs_the_others(home):
    dana, noa, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    dana.post(f"{path}/owners", json={"username": "noa_r"})
    add_id = requests_of(noa, path)[0]["id"]
    answer(noa, market_id, add_id, "approve")
    answer(tal, market_id, add_id, "approve")

    request = dana.delete(f"{path}/owners/tal_b").json()["requests"][0]
    # Tal, who's being removed, isn't asked.
    assert [p["username"] for p in request["waiting_for"]] == ["noa_r"]
    answer(noa, market_id, request["id"], "approve")

    assert owners(dana, path) == ["dana_k", "noa_r"]


def test_stepping_down(home):
    dana, _, tal, _, path = home
    assert dana.delete(f"{path}/owners/dana_k").status_code == 409  # the only owner
    make_co_owner(home, tal, "tal_b")

    assert dana.delete(f"{path}/owners/dana_k").status_code == 200
    assert owners(tal, path) == ["tal_b"]


def test_stepping_down_lets_waiting_requests_through(home):
    dana, _, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    tal.patch(path, json={"name": "Back rub"})

    dana.delete(f"{path}/owners/dana_k")

    assert tal.get(path).json()["name"] == "Back rub"


def test_owners_propose(home):
    dana, noa, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")

    response = tal.post(f"{path}/proposals", json={"sellers": ["dana_k"], "price": 30})

    assert response.status_code == 201
    assert (
        noa.post(f"{path}/proposals", json={"sellers": ["dana_k"], "price": 30}).status_code == 403
    )


def test_sell_it_myself(home):
    dana, noa, _, _, path = home
    new = {"price": 25, "terms": TERMS}

    assert noa.post(f"{path}/my-offer", json=new).status_code == 403  # not an owner
    sold = dana.post(f"{path}/my-offer", json=new).json()
    assert [o["price"] for o in sold["offers"]] == [25, 30]
    assert dana.post(f"{path}/my-offer", json=new).status_code == 409  # already sells it


def test_last_owner_leaving_lets_sellers_claim(home):
    dana, noa, tal, market_id, path = home

    assert dana.post(f"/markets/{market_id}/leave").status_code == 204
    seen = noa.get(path).json()
    assert seen["owners"] == []
    assert seen["can_claim"] is True

    assert tal.post(f"{path}/claim").status_code == 403  # Tal doesn't sell it
    assert noa.post(f"{path}/claim").json()["is_mine"] is True
    assert noa.post(f"{path}/claim").status_code == 409


def test_leaving_cancels_your_requests(home):
    dana, _, tal, market_id, path = home
    make_co_owner(home, tal, "tal_b")
    tal.patch(path, json={"name": "Back rub"})

    tal.post(f"/markets/{market_id}/leave")

    assert owners(dana, path) == ["dana_k"]
    assert requests_of(dana, path) == []
    assert dana.get(path).json()["name"] == "Massage"
