from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update

from app import cleanup
from app.models import Invite, LedgerEntry, Market, Membership

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 1000,
    "time_zone": "Asia/Jerusalem",
}


@pytest.fixture
def home(member):
    """Dana and Noa in Dana's market. Returns (dana, noa, market_id)."""
    dana, noa = member("dana_k"), member("noa_r")
    market_id = dana.post("/markets", json=NEW_MARKET).json()["id"]
    invite_id = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()["id"]
    noa.post(f"/invites/{invite_id}/accept")
    return dana, noa, market_id


def days_ago(days: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


def test_leaving_hides_the_market(home):
    dana, noa, market_id = home

    assert noa.post(f"/markets/{market_id}/leave").status_code == 204
    assert noa.get("/markets").json() == []
    assert noa.get(f"/markets/{market_id}").status_code == 404
    assert [m["username"] for m in dana.get(f"/markets/{market_id}/members").json()] == ["dana_k"]


def test_left_markets_show_frozen_coins(home):
    _, noa, market_id = home
    noa.post(f"/markets/{market_id}/leave")

    left = noa.get("/markets/left").json()

    assert len(left) == 1
    assert left[0]["name"] == "Home"
    assert left[0]["my_balance"] == 1000
    rejoin_until = datetime.fromisoformat(left[0]["rejoin_until"])
    left_at = datetime.fromisoformat(left[0]["left_at"])
    assert rejoin_until - left_at == timedelta(days=30)


def test_cannot_leave_twice(home):
    _, noa, market_id = home
    noa.post(f"/markets/{market_id}/leave")

    assert noa.post(f"/markets/{market_id}/leave").status_code == 404


def test_rejoin_within_30_days_restores_coins(home):
    _, noa, market_id = home
    noa.post(f"/markets/{market_id}/leave")

    response = noa.post(f"/markets/{market_id}/rejoin")

    assert response.status_code == 200
    assert response.json()["my_balance"] == 1000
    assert noa.get("/markets/left").json() == []
    # No second starting amount.
    assert len(noa.get(f"/markets/{market_id}/ledger").json()) == 1


def test_rejoin_after_30_days_needs_an_invite(db, home):
    _, noa, market_id = home
    noa.post(f"/markets/{market_id}/leave")
    db.execute(
        update(Membership).where(Membership.left_at.is_not(None)).values(left_at=days_ago(31))
    )

    response = noa.post(f"/markets/{market_id}/rejoin")

    assert response.status_code == 410
    assert noa.get("/markets/left").json() == []


def test_invited_back_after_30_days_gets_frozen_coins_not_starting_amount(db, home):
    dana, noa, market_id = home
    noa.post(f"/markets/{market_id}/leave")
    db.execute(
        update(Membership).where(Membership.left_at.is_not(None)).values(left_at=days_ago(31))
    )
    invite_id = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()["id"]

    response = noa.post(f"/invites/{invite_id}/accept")

    assert response.status_code == 200
    assert response.json()["my_balance"] == 1000
    assert len(noa.get(f"/markets/{market_id}/ledger").json()) == 1


def test_leaving_cancels_your_invites_only(member, home):
    dana, noa, market_id = home
    tal, gal = member("tal_s"), member("gal_m")
    noa.post(f"/markets/{market_id}/invites", json={"username": "tal_s"})
    dana.post(f"/markets/{market_id}/invites", json={"username": "gal_m"})

    noa.post(f"/markets/{market_id}/leave")

    assert tal.get("/invites").json() == []
    assert len(gal.get("/invites").json()) == 1


def test_last_member_leaving_archives_and_rejoining_restores(db, home):
    dana, noa, market_id = home
    noa.post(f"/markets/{market_id}/leave")
    assert db.get(Market, market_id).archived_at is None

    dana.post(f"/markets/{market_id}/leave")
    db.expire_all()
    assert db.get(Market, market_id).archived_at is not None

    dana.post(f"/markets/{market_id}/rejoin")
    db.expire_all()
    assert db.get(Market, market_id).archived_at is None


def test_cleanup_deletes_markets_empty_for_30_days(db, home):
    dana, noa, market_id = home
    noa.post(f"/markets/{market_id}/leave")
    dana.post(f"/markets/{market_id}/leave")
    db.execute(update(Market).where(Market.id == market_id).values(archived_at=days_ago(31)))

    assert cleanup.delete_old_empty_markets(db) == 1

    assert db.get(Market, market_id) is None
    assert db.scalars(select(Membership).where(Membership.market_id == market_id)).all() == []
    assert db.scalars(select(Invite).where(Invite.market_id == market_id)).all() == []
    assert db.scalars(select(LedgerEntry)).all() == []


def test_cleanup_keeps_recently_emptied_and_active_markets(db, member, home):
    dana, noa, market_id = home
    other = member("tal_s").post("/markets", json=NEW_MARKET).json()["id"]
    noa.post(f"/markets/{market_id}/leave")
    dana.post(f"/markets/{market_id}/leave")
    db.execute(update(Market).where(Market.id == market_id).values(archived_at=days_ago(29)))

    assert cleanup.delete_old_empty_markets(db) == 0
    assert db.get(Market, market_id) is not None
    assert db.get(Market, other) is not None
