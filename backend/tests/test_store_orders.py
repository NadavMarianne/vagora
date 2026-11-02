from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, update

from app.models import LedgerEntry, Membership, Order

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 100,
    "time_zone": "Asia/Jerusalem",
}

DAY = 24 * 3600
TERMS = {"delivery": "deadline", "duration_seconds": 3 * DAY, "refundable": True}


@pytest.fixture
def home(member):
    """Dana (buyer) and Noa (seller) in Dana's market, 100 coins each. Returns (dana, noa, id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()
    noa.post(f"/invites/{invite['id']}/accept")
    return dana, noa, market_id


def noa_sells(home, price=30, coin_mode="to_seller", **terms):
    """Noa sells a product to Dana's market. Returns the offer's ID."""
    dana, noa, market_id = home
    product = dana.post(
        f"/markets/{market_id}/products",
        json={"name": "Massage", "coin_mode": coin_mode, "price": price, "sellers": ["noa_r"]},
    ).json()
    proposal = noa.get(f"/markets/{market_id}/proposals").json()[0]
    noa.post(f"/markets/{market_id}/proposals/{proposal['id']}/accept", json={**TERMS, **terms})
    return dana.get(f"/markets/{market_id}/products/{product['id']}").json()["offers"][0]["id"]


def buy(home, **offer):
    dana, _, market_id = home
    offer_id = noa_sells(home, **offer)
    return dana.post(f"/markets/{market_id}/offers/{offer_id}/buy")


def balance(client, market_id):
    return client.get(f"/markets/{market_id}").json()["my_balance"]


def act(client, market_id, order_id, action):
    return client.post(f"/markets/{market_id}/orders/{order_id}/{action}")


def test_buying_holds_the_price(home):
    dana, noa, market_id = home

    order = buy(home).json()

    assert order["status"] == "open"
    assert order["role"] == "buyer"
    assert balance(dana, market_id) == 70
    assert balance(noa, market_id) == 100
    assert [o["role"] for o in noa.get(f"/markets/{market_id}/orders").json()] == ["seller"]


def test_fulfilled_pays_the_seller(home):
    dana, noa, market_id = home
    order = buy(home).json()

    done = act(dana, market_id, order["id"], "fulfilled").json()

    assert done["status"] == "completed"
    assert balance(dana, market_id) == 70
    assert balance(noa, market_id) == 130


def test_vanish_pays_no_one(home):
    dana, noa, market_id = home
    order = buy(home, coin_mode="vanish").json()

    act(dana, market_id, order["id"], "fulfilled")

    assert balance(dana, market_id) == 70
    assert balance(noa, market_id) == 100


def test_not_enough_coins(home):
    dana, _, market_id = home

    response = buy(home, price=101)

    assert response.status_code == 409
    assert balance(dana, market_id) == 100


def test_cant_buy_your_own_offer(home):
    _, noa, market_id = home
    offer_id = noa_sells(home)

    assert noa.post(f"/markets/{market_id}/offers/{offer_id}/buy").status_code == 409


def test_stock_runs_out(home):
    dana, _, market_id = home
    offer_id = noa_sells(home, price=10, stock=2, commitment={"stock": 2})
    path = f"/markets/{market_id}/offers/{offer_id}/buy"

    assert dana.post(path).status_code == 201
    assert dana.post(path).status_code == 201
    assert dana.post(path).status_code == 409


def test_stock_commitment_counts_down(home):
    dana, noa, market_id = home
    offer_id = noa_sells(home, price=10, commitment={"stock": 1})

    dana.post(f"/markets/{market_id}/offers/{offer_id}/buy")

    # The one guaranteed purchase was made, so Noa can remove the offer now.
    assert noa.delete(f"/markets/{market_id}/offers/{offer_id}").status_code == 204


def test_orders_keep_their_price(home):
    dana, noa, market_id = home
    offer_id = noa_sells(home)
    order = dana.post(f"/markets/{market_id}/offers/{offer_id}/buy").json()

    noa.patch(f"/markets/{market_id}/offers/{offer_id}", json={"price": 99})
    noa.delete(f"/markets/{market_id}/offers/{offer_id}")
    act(dana, market_id, order["id"], "fulfilled")

    assert balance(noa, market_id) == 130


def test_seller_done_completes_after_three_days(home, db):
    dana, noa, market_id = home
    order = buy(home).json()

    claimed = act(noa, market_id, order["id"], "done").json()
    assert claimed["status"] == "done_claimed"
    assert claimed["auto_complete_at"] is not None
    assert balance(noa, market_id) == 100

    db.execute(update(Order).values(done_claimed_at=datetime.now(UTC) - timedelta(days=3)))
    assert balance(noa, market_id) == 130
    assert dana.get(f"/markets/{market_id}/orders/{order['id']}").json()["status"] == "completed"


def test_dispute_holds_the_coins(home, db):
    dana, noa, market_id = home
    order = buy(home).json()
    act(noa, market_id, order["id"], "done")

    assert act(dana, market_id, order["id"], "dispute").json()["status"] == "disputed"
    db.execute(update(Order).values(done_claimed_at=datetime.now(UTC) - timedelta(days=4)))

    assert balance(noa, market_id) == 100
    assert balance(dana, market_id) == 70


def test_seller_gives_up_a_dispute(home):
    dana, noa, market_id = home
    order = buy(home).json()
    act(noa, market_id, order["id"], "done")
    act(dana, market_id, order["id"], "dispute")

    assert act(noa, market_id, order["id"], "refund").json()["status"] == "cancelled"
    assert balance(dana, market_id) == 100


def test_buyer_gives_up_a_dispute(home):
    dana, noa, market_id = home
    order = buy(home).json()
    act(noa, market_id, order["id"], "done")
    act(dana, market_id, order["id"], "dispute")

    assert act(dana, market_id, order["id"], "fulfilled").json()["status"] == "completed"
    assert balance(noa, market_id) == 130


def test_cancel_gives_the_refund_percentage(home):
    dana, noa, market_id = home
    order = buy(home, refund_percent=50, price=31).json()

    assert act(dana, market_id, order["id"], "cancel").json()["status"] == "cancelled"
    # 50% of 31 rounds to 16 back; the other 15 go to the seller.
    assert balance(dana, market_id) == 69 + 16
    assert balance(noa, market_id) == 115


def test_cancel_after_the_deadline_waits_for_the_seller(home, db):
    dana, _, market_id = home
    order = buy(home).json()
    db.execute(update(Order).values(due_at=datetime.now(UTC) - timedelta(seconds=1)))

    # Past the deadline, cancelling is a claim the seller can contest (test_store_missed.py).
    assert act(dana, market_id, order["id"], "cancel").json()["status"] == "cancel_pending"
    assert balance(dana, market_id) == 70


def test_non_refundable_cant_be_cancelled(home):
    dana, _, market_id = home
    order = buy(home, refundable=False).json()

    assert act(dana, market_id, order["id"], "cancel").status_code == 409


def test_discard_gives_nothing_back(home):
    dana, noa, market_id = home
    order = buy(home, refundable=False).json()

    assert act(dana, market_id, order["id"], "discard").json()["status"] == "discarded"
    assert balance(dana, market_id) == 70
    assert balance(noa, market_id) == 130


def test_refund_request_accepted(home):
    dana, noa, market_id = home
    order = buy(home, refundable=False).json()

    asked = act(dana, market_id, order["id"], "request-refund").json()
    assert asked["refund_requested"] is True
    assert act(noa, market_id, order["id"], "refund").json()["status"] == "cancelled"
    assert balance(dana, market_id) == 100


def test_refund_request_declined(home):
    dana, noa, market_id = home
    order = buy(home, refundable=False).json()
    act(dana, market_id, order["id"], "request-refund")

    declined = act(noa, market_id, order["id"], "decline-refund").json()

    assert declined["refund_requested"] is False
    assert declined["status"] == "open"


def test_only_the_right_side_acts(home):
    dana, noa, market_id = home
    order = buy(home).json()

    assert act(noa, market_id, order["id"], "fulfilled").status_code == 403
    assert act(dana, market_id, order["id"], "done").status_code == 403


def test_on_request_expires_with_refund(home, db):
    dana, noa, market_id = home
    order = buy(home, delivery="on_request", refund_percent=80).json()
    db.execute(update(Order).values(due_at=datetime.now(UTC) - timedelta(seconds=1)))

    assert dana.get(f"/markets/{market_id}/orders/{order['id']}").json()["status"] == "expired"
    assert balance(dana, market_id) == 70 + 24
    assert balance(noa, market_id) == 106


def test_passed_deadline_is_missed(home, db):
    dana, _, market_id = home
    order = buy(home).json()
    db.execute(update(Order).values(due_at=datetime.now(UTC) - timedelta(seconds=1)))

    seen = dana.get(f"/markets/{market_id}/orders/{order['id']}").json()

    assert seen["status"] == "missed"
    assert seen["missed_count"] == 1


def test_ended_orders_cant_end_again(home):
    dana, noa, market_id = home
    order = buy(home).json()
    act(dana, market_id, order["id"], "fulfilled")

    assert act(noa, market_id, order["id"], "refund").status_code == 409
    assert balance(noa, market_id) == 130


def test_seller_cant_leave_with_orders(home):
    dana, noa, market_id = home
    order = buy(home).json()

    assert noa.post(f"/markets/{market_id}/leave").status_code == 409
    act(dana, market_id, order["id"], "fulfilled")
    assert noa.post(f"/markets/{market_id}/leave").status_code == 204


def test_buyer_can_leave_and_refunds_wait(home, db):
    dana, noa, market_id = home
    buy(home, delivery="on_request")

    assert dana.post(f"/markets/{market_id}/leave").status_code == 204
    db.execute(update(Order).values(due_at=datetime.now(UTC) - timedelta(seconds=1)))
    noa.get(f"/markets/{market_id}")  # anyone using the market catches it up

    frozen = dana.get("/markets/left").json()[0]["my_balance"]
    assert frozen == 100


def test_ledger_matches_balances(home, db):
    dana, noa, market_id = home
    for _ in range(3):
        order = buy(home, price=10, refund_percent=30).json()
        act(dana, market_id, order["id"], "cancel")

    for membership in db.scalars(select(Membership).where(Membership.market_id == market_id)):
        total = db.scalar(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
                LedgerEntry.membership_id == membership.id
            )
        )
        assert total == membership.balance
