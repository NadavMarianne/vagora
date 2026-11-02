from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.models import Market, Order

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 100,
    "time_zone": "Asia/Jerusalem",
}

DAY = 24 * 3600
TERMS = {"delivery": "deadline", "duration_seconds": 3 * DAY, "refundable": False}


@pytest.fixture
def home(member):
    """Dana (buyer) and Noa (seller), 100 coins each. Returns (dana, noa, market_id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()
    noa.post(f"/invites/{invite['id']}/accept")
    return dana, noa, market_id


def buy(home, **terms):
    """Dana buys Noa's offer for 30. Returns the order's ID."""
    dana, noa, market_id = home
    product = dana.post(
        f"/markets/{market_id}/products",
        json={"name": "Massage", "coin_mode": "to_seller", "price": 30, "sellers": ["noa_r"]},
    ).json()
    proposal = noa.get(f"/markets/{market_id}/proposals").json()[0]
    noa.post(f"/markets/{market_id}/proposals/{proposal['id']}/accept", json={**TERMS, **terms})
    offer = dana.get(f"/markets/{market_id}/products/{product['id']}").json()["offers"][0]
    return dana.post(f"/markets/{market_id}/offers/{offer['id']}/buy").json()["id"]


def miss_it(db):
    db.execute(update(Order).values(due_at=datetime.now(UTC) - timedelta(seconds=1)))


def act(client, market_id, order_id, action, **body):
    return client.post(f"/markets/{market_id}/orders/{order_id}/{action}", json=body or None)


def state(client, market_id, order_id):
    return client.get(f"/markets/{market_id}/orders/{order_id}").json()


def balance(client, market_id):
    return client.get(f"/markets/{market_id}").json()["my_balance"]


@pytest.fixture
def missed(home, db):
    """An order whose deadline was missed. Returns (dana, noa, market_id, order_id)."""
    dana, noa, market_id = home
    order_id = buy(home)
    miss_it(db)
    assert state(dana, market_id, order_id)["status"] == "missed"
    return dana, noa, market_id, order_id


def test_on_request_refused_is_a_miss(home):
    dana, noa, market_id = home
    order_id = buy(home, delivery="on_request")

    assert act(dana, market_id, order_id, "refused").json()["status"] == "missed"
    assert balance(dana, market_id) == 70  # nothing moves yet


def test_only_on_request_can_be_refused(home):
    dana, _, market_id = home
    order_id = buy(home)

    assert act(dana, market_id, order_id, "refused").status_code == 409


def test_cancel_waits_for_the_contest_window(missed, db):
    dana, noa, market_id, order_id = missed

    pending = act(dana, market_id, order_id, "cancel").json()
    assert pending["status"] == "cancel_pending"
    assert pending["contest_until"] is not None
    assert balance(dana, market_id) == 70

    db.execute(update(Order).values(contest_until=datetime.now(UTC) - timedelta(seconds=1)))
    assert state(dana, market_id, order_id)["status"] == "not_delivered"
    # A missed deadline refunds in full, even on a non-refundable order.
    assert balance(dana, market_id) == 100
    assert balance(noa, market_id) == 100


def test_contest_window_is_a_market_setting(missed, db):
    dana, _, market_id, order_id = missed
    dana.patch(f"/markets/{market_id}", json={"contest_window_seconds": 60})

    pending = act(dana, market_id, order_id, "cancel").json()

    until = datetime.fromisoformat(pending["contest_until"])
    assert until - datetime.now(UTC) < timedelta(seconds=61)
    assert db.get(Market, market_id).contest_window_seconds == 60


def test_seller_contests_and_it_becomes_a_dispute(missed, db):
    dana, noa, market_id, order_id = missed
    act(dana, market_id, order_id, "cancel")

    assert act(noa, market_id, order_id, "done").json()["status"] == "disputed"
    db.execute(update(Order).values(contest_until=datetime.now(UTC) - timedelta(days=9)))
    assert state(dana, market_id, order_id)["status"] == "disputed"
    assert balance(dana, market_id) == 70


def test_seller_accepts_the_cancellation(missed):
    dana, noa, market_id, order_id = missed
    act(dana, market_id, order_id, "cancel")

    assert act(noa, market_id, order_id, "refund").json()["status"] == "not_delivered"
    assert balance(dana, market_id) == 100


def test_accept_late_then_done(missed):
    dana, noa, market_id, order_id = missed

    assert act(dana, market_id, order_id, "accept-late").json()["status"] == "late_accepted"
    assert act(noa, market_id, order_id, "done").json()["status"] == "done_claimed"
    assert act(dana, market_id, order_id, "fulfilled").json()["status"] == "completed"
    assert balance(noa, market_id) == 130


def test_late_accepted_can_still_cancel(missed):
    dana, _, market_id, order_id = missed
    act(dana, market_id, order_id, "accept-late")

    assert act(dana, market_id, order_id, "cancel").json()["status"] == "cancel_pending"


def test_new_deadline_agreed(missed, db):
    dana, noa, market_id, order_id = missed

    asked = act(dana, market_id, order_id, "new-deadline", deadline_seconds=DAY).json()
    assert asked["status"] == "new_deadline_asked"
    assert asked["new_deadline_seconds"] == DAY

    agreed = act(noa, market_id, order_id, "agree-deadline").json()
    assert agreed["status"] == "open"
    due = datetime.fromisoformat(agreed["due_at"])
    assert timedelta(hours=23) < due - datetime.now(UTC) <= timedelta(days=1)

    # Missing the new deadline is a second miss.
    miss_it(db)
    seen = state(dana, market_id, order_id)
    assert seen["status"] == "missed"
    assert seen["missed_count"] == 2


def test_new_deadline_declined(missed):
    dana, noa, market_id, order_id = missed
    act(dana, market_id, order_id, "new-deadline", deadline_seconds=DAY)

    assert act(noa, market_id, order_id, "decline-deadline").json()["status"] == "missed"
    # The buyer can propose again.
    again = act(dana, market_id, order_id, "new-deadline", deadline_seconds=2 * DAY)
    assert again.json()["status"] == "new_deadline_asked"


def test_new_deadline_not_answered(missed, db):
    dana, _, market_id, order_id = missed
    act(dana, market_id, order_id, "new-deadline", deadline_seconds=DAY, expires_in_seconds=10)
    db.execute(
        update(Order).values(new_deadline_answer_by=datetime.now(UTC) - timedelta(seconds=1))
    )

    seen = state(dana, market_id, order_id)

    assert seen["status"] == "missed"
    assert seen["new_deadline_seconds"] is None


def test_on_request_new_deadline_becomes_fixed(home, db):
    dana, noa, market_id = home
    order_id = buy(home, delivery="on_request")
    act(dana, market_id, order_id, "refused")
    act(dana, market_id, order_id, "new-deadline", deadline_seconds=DAY)

    agreed = act(noa, market_id, order_id, "agree-deadline").json()

    assert agreed["delivery"] == "deadline"


@pytest.mark.parametrize("step", [None, "accept-late", "new-deadline"])
def test_seller_ends_the_order(missed, step):
    dana, noa, market_id, order_id = missed
    if step:
        act(
            dana,
            market_id,
            order_id,
            step,
            **({"deadline_seconds": DAY} if step == "new-deadline" else {}),
        )

    ended = act(noa, market_id, order_id, "end").json()

    assert ended["status"] == "seller_ended"
    assert balance(dana, market_id) == 100
    assert balance(noa, market_id) == 100


def test_seller_cant_end_before_a_miss(home):
    _, noa, market_id = home
    order_id = buy(home)

    assert act(noa, market_id, order_id, "end").status_code == 409


def test_buyer_choices_only_after_a_miss(home):
    dana, _, market_id = home
    order_id = buy(home)

    assert act(dana, market_id, order_id, "accept-late").status_code == 409
    assert act(dana, market_id, order_id, "new-deadline", deadline_seconds=DAY).status_code == 409


def test_seller_cant_leave_while_missed(missed):
    _, noa, market_id, _ = missed

    assert noa.post(f"/markets/{market_id}/leave").status_code == 409
