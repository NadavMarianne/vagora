from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update

from app.models import Invite, Membership

NEW_MARKET = {
    "name": "Home",
    "currency_name": "hearts",
    "starting_amount": 1000,
    "time_zone": "Asia/Jerusalem",
}


@pytest.fixture
def dana_market(member):
    """Dana's client and the ID of a market she created."""
    dana = member("dana_k")
    return dana, dana.post("/markets", json=NEW_MARKET).json()["id"]


def invite(client, market_id, username, **extra):
    return client.post(f"/markets/{market_id}/invites", json={"username": username, **extra})


def expire_all_invites(db):
    db.execute(update(Invite).values(expires_at=datetime.now(UTC) - timedelta(minutes=1)))


def test_invite_shows_who_sent_it(member, dana_market):
    dana, market_id = dana_market
    noa = member("noa_r")

    sent = invite(dana, market_id, "noa_r")
    received = noa.get("/invites").json()

    assert sent.status_code == 201
    assert len(received) == 1
    assert received[0]["market_name"] == "Home"
    assert received[0]["invited_by_display_name"] == "Dana_K"
    assert received[0]["invited_by_username"] == "dana_k"


def test_accepting_joins_with_starting_amount(member, dana_market):
    dana, market_id = dana_market
    noa = member("noa_r")
    invite_id = invite(dana, market_id, "noa_r").json()["id"]

    response = noa.post(f"/invites/{invite_id}/accept")

    assert response.status_code == 200
    assert response.json()["my_balance"] == 1000
    assert noa.get("/invites").json() == []
    assert [m["name"] for m in noa.get("/markets").json()] == ["Home"]


def test_member_list(member, dana_market):
    dana, market_id = dana_market
    noa = member("noa_r")
    noa.post(f"/invites/{invite(dana, market_id, 'noa_r').json()['id']}/accept")

    members = noa.get(f"/markets/{market_id}/members").json()

    assert [m["username"] for m in members] == ["dana_k", "noa_r"]
    assert set(members[0]) == {"username", "display_name", "joined_at"}


def test_who_invited_whom_is_saved_for_the_chat(db, member, dana_market):
    dana, market_id = dana_market
    noa, tal = member("noa_r"), member("tal_s")
    noa.post(f"/invites/{invite(dana, market_id, 'noa_r').json()['id']}/accept")
    tal.post(f"/invites/{invite(noa, market_id, 'tal_s').json()['id']}/accept")

    memberships = db.scalars(
        select(Membership).where(Membership.market_id == market_id).order_by(Membership.id)
    )

    assert [(m.user.username, m.invited_by and m.invited_by.username) for m in memberships] == [
        ("dana_k", None),
        ("noa_r", "dana_k"),
        ("tal_s", "noa_r"),
    ]


def test_open_invites_show_who_is_invited_not_who_invited(member, dana_market):
    dana, market_id = dana_market
    member("noa_r")
    invite(dana, market_id, "noa_r")

    pending = dana.get(f"/markets/{market_id}/invites").json()

    assert [i["invited_username"] for i in pending] == ["noa_r"]
    assert "invited_by_username" not in pending[0]
    assert "invited_by_display_name" not in pending[0]


def test_declining(member, dana_market):
    dana, market_id = dana_market
    noa = member("noa_r")
    invite_id = invite(dana, market_id, "noa_r").json()["id"]

    assert noa.post(f"/invites/{invite_id}/decline").status_code == 204
    assert noa.get("/markets").json() == []
    assert noa.post(f"/invites/{invite_id}/accept").status_code == 404


def test_can_invite_again_after_decline(member, dana_market):
    dana, market_id = dana_market
    noa = member("noa_r")
    noa.post(f"/invites/{invite(dana, market_id, 'noa_r').json()['id']}/decline")

    assert invite(dana, market_id, "noa_r").status_code == 201


def test_unknown_username(dana_market):
    dana, market_id = dana_market

    response = invite(dana, market_id, "nobody_here")

    assert response.status_code == 404
    assert response.json()["detail"] == "No one has that username."


def test_username_is_not_case_sensitive(member, dana_market):
    dana, market_id = dana_market
    member("noa_r")

    assert invite(dana, market_id, "NOA_R").status_code == 201


def test_cannot_invite_a_member(dana_market):
    dana, market_id = dana_market

    response = invite(dana, market_id, "dana_k")

    assert response.status_code == 409
    assert response.json()["detail"] == "They're already in this market."


def test_cannot_invite_twice(member, dana_market):
    dana, market_id = dana_market
    member("noa_r")
    invite(dana, market_id, "noa_r")

    response = invite(dana, market_id, "noa_r")

    assert response.status_code == 409
    assert response.json()["detail"] == "They already have an invite."


def test_only_members_can_invite(member, dana_market):
    _, market_id = dana_market
    outsider = member("tal_s")
    member("noa_r")

    assert invite(outsider, market_id, "noa_r").status_code == 404


def test_inviter_sets_expiry(member, dana_market):
    dana, market_id = dana_market
    member("noa_r")

    before = datetime.now(UTC)
    expires_at = datetime.fromisoformat(
        invite(dana, market_id, "noa_r", expires_in_hours=2).json()["expires_at"]
    )

    assert timedelta(hours=1, minutes=59) < expires_at - before < timedelta(hours=2, minutes=1)


def test_default_expiry_is_seven_days(member, dana_market):
    dana, market_id = dana_market
    member("noa_r")

    before = datetime.now(UTC)
    expires_at = datetime.fromisoformat(invite(dana, market_id, "noa_r").json()["expires_at"])

    assert timedelta(days=6, hours=23) < expires_at - before < timedelta(days=7, hours=1)


@pytest.mark.parametrize("hours", [0, 30 * 24 + 1])
def test_expiry_limits(member, dana_market, hours):
    dana, market_id = dana_market
    member("noa_r")

    assert invite(dana, market_id, "noa_r", expires_in_hours=hours).status_code == 422


def test_expired_invite_cannot_be_accepted(db, member, dana_market):
    dana, market_id = dana_market
    noa = member("noa_r")
    invite_id = invite(dana, market_id, "noa_r").json()["id"]
    expire_all_invites(db)

    response = noa.post(f"/invites/{invite_id}/accept")

    assert response.status_code == 410
    assert noa.get("/invites").json() == []


def test_can_invite_again_after_expiry(db, member, dana_market):
    dana, market_id = dana_market
    member("noa_r")
    invite(dana, market_id, "noa_r")
    expire_all_invites(db)

    assert invite(dana, market_id, "noa_r").status_code == 201


def test_any_member_can_cancel(member, dana_market):
    dana, market_id = dana_market
    noa, tal = member("noa_r"), member("tal_s")
    noa.post(f"/invites/{invite(dana, market_id, 'noa_r').json()['id']}/accept")
    invite_id = invite(dana, market_id, "tal_s").json()["id"]

    assert noa.delete(f"/markets/{market_id}/invites/{invite_id}").status_code == 204
    assert tal.get("/invites").json() == []
    assert tal.post(f"/invites/{invite_id}/accept").status_code == 404


def test_cannot_answer_someone_elses_invite(member, dana_market):
    dana, market_id = dana_market
    member("noa_r")
    tal = member("tal_s")
    invite_id = invite(dana, market_id, "noa_r").json()["id"]

    assert tal.post(f"/invites/{invite_id}/accept").status_code == 404
    assert tal.post(f"/invites/{invite_id}/decline").status_code == 404
