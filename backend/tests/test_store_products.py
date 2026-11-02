from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.models import Offer, Proposal

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 1000,
    "time_zone": "Asia/Jerusalem",
}

TERMS = {"delivery": "deadline", "duration_seconds": 3 * 24 * 3600, "refundable": True}


@pytest.fixture
def home(member):
    """Dana, Noa and Tal in Dana's market. Returns (dana, noa, tal, market_id)."""
    dana, noa, tal = member("dana_k"), member("noa_r"), member("tal_b")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    for client, username in ((noa, "noa_r"), (tal, "tal_b")):
        invite = dana.post(f"/markets/{market_id}/invites", json={"username": username}).json()
        client.post(f"/invites/{invite['id']}/accept")
    return dana, noa, tal, market_id


def create(client, market_id, **extra):
    product = {"name": "Massage", "coin_mode": "to_seller", "price": 30, **extra}
    return client.post(f"/markets/{market_id}/products", json=product)


def in_days(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def accept(client, market_id, terms=TERMS):
    proposal = client.get(f"/markets/{market_id}/proposals").json()[0]
    return client.post(f"/markets/{market_id}/proposals/{proposal['id']}/accept", json=terms)


def test_product_waits_until_a_seller_accepts(home):
    dana, noa, _, market_id = home

    product = create(dana, market_id, sellers=["noa_r"]).json()
    assert product["status"] == "waiting"
    assert product["proposals"][0]["seller_username"] == "noa_r"

    proposals = noa.get(f"/markets/{market_id}/proposals").json()
    assert [(p["product_name"], p["price"]) for p in proposals] == [("Massage", 30)]

    live = accept(noa, market_id).json()
    assert live["status"] == "live"
    assert live["offers"][0]["seller_username"] == "noa_r"
    assert live["offers"][0]["price"] == 30
    assert noa.get(f"/markets/{market_id}/proposals").json() == []


def test_only_the_creator_sees_proposals(home):
    dana, noa, tal, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]

    seen = tal.get(f"/markets/{market_id}/products/{product_id}").json()

    assert seen["proposals"] == []
    assert seen["is_mine"] is False


def test_creator_can_sell_it_too(home):
    dana, _, _, market_id = home

    product = create(dana, market_id, my_offer=TERMS).json()

    assert product["status"] == "live"
    assert product["offers"][0]["is_mine"] is True


def test_needs_a_seller(home):
    dana, _, _, market_id = home

    assert create(dana, market_id).status_code == 422


def test_creator_cant_propose_to_themselves(home):
    dana, _, _, market_id = home

    assert create(dana, market_id, sellers=["dana_k"]).status_code == 422


def test_sellers_must_be_members(home, member):
    dana, _, _, market_id = home
    member("stranger")

    assert create(dana, market_id, sellers=["stranger"]).status_code == 404


def test_declined_seller_gets_a_new_price(home):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]
    proposal_id = noa.get(f"/markets/{market_id}/proposals").json()[0]["id"]

    assert noa.post(f"/markets/{market_id}/proposals/{proposal_id}/decline").status_code == 204
    product = dana.get(f"/markets/{market_id}/products/{product_id}").json()
    assert product["status"] == "no_sellers"

    again = dana.post(
        f"/markets/{market_id}/products/{product_id}/proposals",
        json={"sellers": ["noa_r"], "price": 40},
    )
    assert again.status_code == 201
    assert accept(noa, market_id).json()["offers"][0]["price"] == 40


def test_no_second_proposal_to_a_seller(home):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]
    path = f"/markets/{market_id}/products/{product_id}/proposals"

    assert dana.post(path, json={"sellers": ["noa_r"], "price": 30}).status_code == 409
    accept(noa, market_id)
    assert dana.post(path, json={"sellers": ["noa_r"], "price": 30}).status_code == 409


def test_only_the_creator_proposes(home):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]

    response = noa.post(
        f"/markets/{market_id}/products/{product_id}/proposals",
        json={"sellers": ["tal_b"], "price": 30},
    )

    assert response.status_code == 403


def test_proposals_expire(home, db):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"], proposal_expiry_seconds=10).json()["id"]
    db.execute(update(Proposal).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))

    assert noa.get(f"/markets/{market_id}/proposals").json() == []
    product = dana.get(f"/markets/{market_id}/products/{product_id}").json()
    assert product["proposals"][0]["status"] == "expired"


def test_proposal_expiry_limits(home):
    dana, _, _, market_id = home

    assert create(dana, market_id, sellers=["noa_r"], proposal_expiry_seconds=9).status_code == 422
    too_long = 30 * 24 * 3600 + 1
    assert (
        create(dana, market_id, sellers=["noa_r"], proposal_expiry_seconds=too_long).status_code
        == 422
    )


def test_products_list_shows_lowest_price(home):
    dana, noa, tal, market_id = home
    create(dana, market_id, sellers=["noa_r", "tal_b"])
    accept(noa, market_id)
    product_id = dana.get(f"/markets/{market_id}/products").json()[0]["id"]
    noa_offer = dana.get(f"/markets/{market_id}/products/{product_id}").json()["offers"][0]
    noa.patch(f"/markets/{market_id}/offers/{noa_offer['id']}", json={"price": 25})
    accept(tal, market_id)

    listed = dana.get(f"/markets/{market_id}/products").json()[0]

    assert listed["offer_count"] == 2
    assert listed["lowest_price"] == 25


def test_creator_edits_name(home):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]
    path = f"/markets/{market_id}/products/{product_id}"

    assert noa.patch(path, json={"name": "Back rub"}).status_code == 403
    assert dana.patch(path, json={"name": "Back rub"}).json()["name"] == "Back rub"


def offer_of(client, market_id, product_id):
    return client.get(f"/markets/{market_id}/products/{product_id}").json()["offers"][0]


def test_free_offer_changes_and_removal(home):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]
    accept(noa, market_id)
    offer = offer_of(noa, market_id, product_id)
    path = f"/markets/{market_id}/offers/{offer['id']}"

    changed = noa.patch(path, json={"price": 99, "terms": {**TERMS, "stock": 3}}).json()
    assert changed["offers"][0]["price"] == 99
    assert changed["offers"][0]["stock"] == 3

    assert dana.delete(path).status_code == 404  # not Dana's offer
    assert noa.delete(path).status_code == 204
    assert dana.get(f"/markets/{market_id}/products/{product_id}").json()["status"] == "no_sellers"


def committed_offer(home, commitment, **terms):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]
    accept(noa, market_id, {**TERMS, **terms, "commitment": commitment})
    offer = offer_of(noa, market_id, product_id)
    return noa, market_id, product_id, offer


def test_committed_offer_is_locked(home):
    noa, market_id, _, offer = committed_offer(home, {"until": in_days(5)})
    path = f"/markets/{market_id}/offers/{offer['id']}"
    assert offer["committed"] is True

    assert noa.delete(path).status_code == 409
    assert noa.patch(path, json={"terms": TERMS}).status_code == 409
    assert noa.patch(path, json={"price": 31}).status_code == 409
    assert noa.patch(path, json={"price": 20}).json()["offers"][0]["price"] == 20
    assert noa.patch(path, json={"price": 30}).status_code == 200


def test_commitment_extends_never_shortens(home):
    noa, market_id, _, offer = committed_offer(home, {"until": in_days(5), "stock": 2}, stock=5)
    path = f"/markets/{market_id}/offers/{offer['id']}"

    assert noa.patch(path, json={"committed_until": in_days(4)}).status_code == 409
    assert noa.patch(path, json={"committed_until": in_days(6)}).status_code == 200
    assert noa.patch(path, json={"committed_stock": 1}).status_code == 409
    assert noa.patch(path, json={"committed_stock": 6}).status_code == 409  # more than the stock
    assert noa.patch(path, json={"committed_stock": 4}).json()["offers"][0]["committed_stock"] == 4


def test_commitment_needs_something(home):
    dana, noa, _, market_id = home
    create(dana, market_id, sellers=["noa_r"])

    assert accept(noa, market_id, {**TERMS, "commitment": {}}).status_code == 422


def test_commitment_cant_promise_more_than_the_stock(home):
    dana, noa, _, market_id = home
    create(dana, market_id, sellers=["noa_r"])

    terms = {**TERMS, "stock": 2, "commitment": {"stock": 3}}
    assert accept(noa, market_id, terms).status_code == 422


def test_removal_date_not_before_commitment(home):
    dana, noa, _, market_id = home
    create(dana, market_id, sellers=["noa_r"])

    terms = {**TERMS, "commitment": {"until": in_days(5)}, "remove_at": in_days(4)}
    assert accept(noa, market_id, terms).status_code == 422


def test_commitment_released_by_time(home, db):
    noa, market_id, _, offer = committed_offer(home, {"until": in_days(5)})
    db.execute(update(Offer).values(committed_until=datetime.now(UTC) - timedelta(seconds=1)))

    assert noa.delete(f"/markets/{market_id}/offers/{offer['id']}").status_code == 204


@pytest.mark.parametrize(
    ("release", "stock_left", "time_passed", "committed"),
    [
        ("first", 0, False, False),
        ("first", 2, True, False),
        ("first", 2, False, True),
        ("all", 0, False, True),
        ("all", 2, True, True),
        ("all", 0, True, False),
    ],
)
def test_commitment_by_time_and_stock(home, db, release, stock_left, time_passed, committed):
    noa, market_id, product_id, offer = committed_offer(
        home, {"until": in_days(5), "stock": 2, "release": release}
    )
    until = datetime.now(UTC) + timedelta(days=-1 if time_passed else 5)
    db.execute(update(Offer).values(committed_stock=stock_left, committed_until=until))

    assert offer_of(noa, market_id, product_id)["committed"] is committed


def test_removal_date_removes_the_offer(home, db):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]
    accept(noa, market_id, {**TERMS, "remove_at": in_days(1)})
    db.execute(update(Offer).values(remove_at=datetime.now(UTC) - timedelta(seconds=1)))

    assert dana.get(f"/markets/{market_id}/products/{product_id}").json()["offers"] == []


def test_closing_keeps_only_committed_offers(home):
    dana, noa, tal, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r", "tal_b"]).json()["id"]
    accept(noa, market_id, {**TERMS, "commitment": {"until": in_days(5)}})
    path = f"/markets/{market_id}/products/{product_id}"
    proposal_to_tal = tal.get(f"/markets/{market_id}/proposals").json()

    assert noa.post(f"{path}/close").status_code == 403
    closed = dana.post(f"{path}/close").json()

    assert closed["status"] == "closed"
    assert [o["seller_username"] for o in closed["offers"]] == ["noa_r"]
    assert len(proposal_to_tal) == 1
    assert tal.get(f"/markets/{market_id}/proposals").json() == []
    response = dana.post(f"{path}/proposals", json={"sellers": ["tal_b"], "price": 30})
    assert response.status_code == 409


def test_closed_product_loses_offer_when_commitment_ends(home, db):
    dana, noa, _, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r"]).json()["id"]
    accept(noa, market_id, {**TERMS, "commitment": {"until": in_days(5)}})
    dana.post(f"/markets/{market_id}/products/{product_id}/close")
    db.execute(update(Offer).values(committed_until=datetime.now(UTC) - timedelta(seconds=1)))

    assert dana.get(f"/markets/{market_id}/products/{product_id}").json()["offers"] == []


def test_cant_leave_with_a_committed_offer(home):
    noa, market_id, _, _ = committed_offer(home, {"until": in_days(5)})

    response = noa.post(f"/markets/{market_id}/leave")

    assert response.status_code == 409


def test_leaving_removes_offers_and_declines_proposals(home):
    dana, noa, tal, market_id = home
    product_id = create(dana, market_id, sellers=["noa_r", "tal_b"]).json()["id"]
    accept(noa, market_id)

    assert noa.post(f"/markets/{market_id}/leave").status_code == 204
    assert tal.post(f"/markets/{market_id}/leave").status_code == 204

    product = dana.get(f"/markets/{market_id}/products/{product_id}").json()
    assert product["offers"] == []
    assert {p["seller_username"]: p["status"] for p in product["proposals"]} == {
        "noa_r": "accepted",
        "tal_b": "declined",
    }


def test_store_is_for_members_only(home, member):
    dana, _, _, market_id = home
    stranger = member("stranger")
    create(dana, market_id, sellers=["noa_r"])

    assert stranger.get(f"/markets/{market_id}/products").status_code == 404
