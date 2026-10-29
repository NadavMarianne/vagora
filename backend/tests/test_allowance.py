from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.allowance import payout_times
from app.models import Membership

JERUSALEM = "Asia/Jerusalem"


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=UTC)


# --- The schedule math ---


def test_daily_several_times():
    schedule = {"frequency": "daily", "times": ["09:00", "21:00"]}

    found = payout_times(schedule, "UTC", utc(2026, 3, 1, 0, 0), utc(2026, 3, 2, 23, 59))

    assert found == [
        utc(2026, 3, 1, 9),
        utc(2026, 3, 1, 21),
        utc(2026, 3, 2, 9),
        utc(2026, 3, 2, 21),
    ]


def test_weekly_on_chosen_days():
    # 2026-03-01 is a Sunday.
    schedule = {"frequency": "weekly", "times": ["10:00"], "weekdays": ["sunday", "wednesday"]}

    found = payout_times(schedule, "UTC", utc(2026, 3, 1), utc(2026, 3, 14, 23))

    assert [moment.day for moment in found] == [1, 4, 8, 11]


def test_monthly_31st_means_last_day_in_short_months():
    schedule = {"frequency": "monthly", "times": ["08:00"], "days": [15, 31]}

    found = payout_times(schedule, "UTC", utc(2026, 1, 31, 9), utc(2026, 4, 1))

    assert found == [
        utc(2026, 2, 15, 8),
        utc(2026, 2, 28, 8),
        utc(2026, 3, 15, 8),
        utc(2026, 3, 31, 8),
    ]


def test_times_are_in_the_market_time_zone():
    schedule = {"frequency": "daily", "times": ["09:00"]}

    # Jerusalem is UTC+2 in January, so 09:00 there is 07:00 UTC.
    found = payout_times(schedule, JERUSALEM, utc(2026, 1, 10, 0), utc(2026, 1, 10, 23))

    assert found == [utc(2026, 1, 10, 7)]


def test_window_excludes_start_and_includes_end():
    schedule = {"frequency": "daily", "times": ["09:00"]}

    found = payout_times(schedule, "UTC", utc(2026, 3, 1, 9), utc(2026, 3, 2, 9))

    assert found == [utc(2026, 3, 2, 9)]


# --- Through the API ---

DAILY = {"frequency": "daily", "times": ["00:00", "12:00"]}


def market_with_allowance(client, **changes):
    settings = {
        "name": "Home",
        "currency_name": "hearts",
        "starting_amount": 0,
        "time_zone": "UTC",
        "allowance_enabled": True,
        "allowance_amount": 10,
        "allowance_schedule": DAILY,
        **changes,
    }
    return client.post("/markets", json=settings)


def last_paid_days_ago(db, days: float):
    """Pretends the allowance was last paid some time ago, as if nobody opened the market since."""
    db.execute(
        update(Membership)
        .where(Membership.left_at.is_(None))
        .values(allowance_paid_until=datetime.now(UTC) - timedelta(days=days))
    )


def test_catch_up_pays_what_came_due(db, member):
    client = member()
    market_id = market_with_allowance(client).json()["id"]
    last_paid_days_ago(db, 3)

    market = client.get(f"/markets/{market_id}").json()

    # Two payouts a day for exactly three days.
    assert market["my_balance"] == 60
    entries = client.get(f"/markets/{market_id}/ledger").json()
    assert {e["kind"] for e in entries} == {"allowance"}
    assert all(e["created_at"].endswith(("T00:00:00Z", "T12:00:00Z")) for e in entries)


def test_catching_up_twice_pays_once(db, member):
    client = member()
    market_id = market_with_allowance(client).json()["id"]
    last_paid_days_ago(db, 2)

    first = client.get(f"/markets/{market_id}").json()["my_balance"]
    second = client.get(f"/markets/{market_id}").json()["my_balance"]

    assert first > 0
    assert second == first


def test_every_member_is_paid(db, member):
    dana, noa = member("dana_k"), member("noa_r")
    market_id = market_with_allowance(dana).json()["id"]
    invite_id = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()["id"]
    noa.post(f"/invites/{invite_id}/accept")
    last_paid_days_ago(db, 1)

    dana.get(f"/markets/{market_id}")

    assert noa.get(f"/markets/{market_id}").json()["my_balance"] == 20


def test_switched_off_pays_nothing(db, member):
    client = member()
    market_id = market_with_allowance(client, allowance_enabled=False).json()["id"]
    last_paid_days_ago(db, 3)

    assert client.get(f"/markets/{market_id}").json()["my_balance"] == 0


def test_switching_on_does_not_pay_for_the_past(db, member):
    client = member()
    market_id = market_with_allowance(client, allowance_enabled=False).json()["id"]
    last_paid_days_ago(db, 3)

    client.patch(f"/markets/{market_id}", json={"allowance_enabled": True})

    assert client.get(f"/markets/{market_id}").json()["my_balance"] == 0


def test_schedule_change_pays_past_dues_then_starts_fresh(db, member):
    client = member()
    market_id = market_with_allowance(client).json()["id"]
    last_paid_days_ago(db, 2)

    weekly = {"frequency": "weekly", "times": ["00:00"], "weekdays": ["monday"]}
    changed = client.patch(f"/markets/{market_id}", json={"allowance_schedule": weekly}).json()

    # The 4 daily payouts already due were paid; the weekly schedule starts from now.
    assert changed["my_balance"] == 40
    assert changed["allowance_schedule"]["frequency"] == "weekly"
    assert client.get(f"/markets/{market_id}").json()["my_balance"] == 40


def test_no_allowance_for_time_away(db, member):
    dana, noa = member("dana_k"), member("noa_r")
    market_id = market_with_allowance(dana).json()["id"]
    invite_id = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()["id"]
    noa.post(f"/invites/{invite_id}/accept")
    noa.post(f"/markets/{market_id}/leave")
    db.execute(
        update(Membership)
        .where(Membership.left_at.is_not(None))
        .values(
            left_at=datetime.now(UTC) - timedelta(days=20),
            allowance_paid_until=datetime.now(UTC) - timedelta(days=20),
        )
    )

    rejoined = noa.post(f"/markets/{market_id}/rejoin").json()

    assert rejoined["my_balance"] == 0


@pytest.mark.parametrize(
    "bad",
    [
        {"allowance_amount": 0},
        {"allowance_schedule": None},
        {"allowance_schedule": {"frequency": "weekly", "times": ["09:00"]}},
        {"allowance_schedule": {"frequency": "monthly", "times": ["09:00"]}},
        {"allowance_schedule": {"frequency": "daily", "times": ["25:00"]}},
        {"allowance_schedule": {"frequency": "daily", "times": []}},
        {"allowance_schedule": {"frequency": "monthly", "times": ["09:00"], "days": [32]}},
        {"allowance_schedule": {"frequency": "weekly", "times": ["09:00"], "weekdays": ["funday"]}},
    ],
)
def test_bad_allowance_settings_are_refused(member, bad):
    assert market_with_allowance(member(), **bad).status_code == 422


def test_schedule_is_tidied(member):
    schedule = {
        "frequency": "weekly",
        "times": ["21:00", "09:00", "09:00"],
        "weekdays": ["sunday", "monday", "sunday"],
        "days": [5],
    }

    market = market_with_allowance(member(), allowance_schedule=schedule).json()

    assert market["allowance_schedule"] == {
        "frequency": "weekly",
        "times": ["09:00", "21:00"],
        "weekdays": ["monday", "sunday"],
        "days": [],
    }
