from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.allowance import payout_times
from app.models import Allowance, Membership

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
WEEKLY = {"frequency": "weekly", "times": ["00:00"], "weekdays": ["monday"]}


def allowance(name="Pocket money", amount=10, schedule=DAILY, **extra):
    return {"name": name, "amount": amount, "schedule": schedule, **extra}


def create_market(client, *allowances, **changes):
    settings = {
        "name": "Home",
        "currency_name": "hearts",
        "starting_amount": 0,
        "time_zone": "UTC",
        "allowances": list(allowances),
        **changes,
    }
    return client.post("/markets", json=settings)


def edit(client, market_id, *allowances):
    return client.patch(f"/markets/{market_id}", json={"allowances": list(allowances)})


def days_ago(days: float) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


def unpaid_since(db, moment: datetime):
    """Pretends members were last paid at `moment`, as if nobody opened the market since."""
    db.execute(
        update(Membership).where(Membership.left_at.is_(None)).values(allowance_paid_until=moment)
    )


def rewind(db, days: float):
    """Pretends nothing was paid for some days, and every allowance existed back then."""
    unpaid_since(db, days_ago(days))
    db.execute(update(Allowance).values(counting_from=days_ago(days)))


def notes(client, market_id):
    return [e["note"] for e in client.get(f"/markets/{market_id}/ledger").json()]


def test_catch_up_pays_what_came_due(db, member):
    client = member()
    market_id = create_market(client, allowance()).json()["id"]
    rewind(db, 3)

    market = client.get(f"/markets/{market_id}").json()

    # Two payouts a day for exactly three days.
    assert market["my_balance"] == 60
    entries = client.get(f"/markets/{market_id}/ledger").json()
    assert {e["kind"] for e in entries} == {"allowance"}
    assert {e["note"] for e in entries} == {"Pocket money"}
    assert all(e["created_at"].endswith(("T00:00:00Z", "T12:00:00Z")) for e in entries)


def test_several_allowances_each_pay_under_their_own_name(db, member):
    client = member()
    market_id = create_market(
        client,
        allowance("Pocket money", 10, DAILY),
        allowance("Bonus", 100, {"frequency": "daily", "times": ["06:00"]}),
    ).json()["id"]
    rewind(db, 2)

    assert client.get(f"/markets/{market_id}").json()["my_balance"] == 4 * 10 + 2 * 100
    paid = notes(client, market_id)
    assert paid.count("Pocket money") == 4
    assert paid.count("Bonus") == 2


def test_names_can_repeat(member):
    market = create_market(member(), allowance("Treat"), allowance("Treat", 5)).json()

    assert [a["name"] for a in market["allowances"]] == ["Treat", "Treat"]


def test_no_limit_on_how_many(member):
    market = create_market(member(), *[allowance(f"#{n}") for n in range(25)]).json()

    assert len(market["allowances"]) == 25


def test_catching_up_twice_pays_once(db, member):
    client = member()
    market_id = create_market(client, allowance()).json()["id"]
    rewind(db, 2)

    first = client.get(f"/markets/{market_id}").json()["my_balance"]
    second = client.get(f"/markets/{market_id}").json()["my_balance"]

    assert first > 0
    assert second == first


def test_every_member_is_paid(db, member):
    dana, noa = member("dana_k"), member("noa_r")
    market_id = create_market(dana, allowance()).json()["id"]
    invite_id = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()["id"]
    noa.post(f"/invites/{invite_id}/accept")
    rewind(db, 1)

    dana.get(f"/markets/{market_id}")

    assert noa.get(f"/markets/{market_id}").json()["my_balance"] == 20


def test_switched_off_pays_nothing(db, member):
    client = member()
    market_id = create_market(client, allowance(enabled=False)).json()["id"]
    rewind(db, 3)

    assert client.get(f"/markets/{market_id}").json()["my_balance"] == 0


def test_switching_on_does_not_pay_for_the_past(db, member):
    client = member()
    market = create_market(client, allowance(enabled=False)).json()
    rewind(db, 3)

    edit(client, market["id"], {**market["allowances"][0], "enabled": True})

    assert client.get(f"/markets/{market['id']}").json()["my_balance"] == 0


def test_schedule_change_pays_past_dues_then_starts_fresh(db, member):
    client = member()
    market = create_market(client, allowance()).json()
    rewind(db, 2)

    changed = edit(client, market["id"], {**market["allowances"][0], "schedule": WEEKLY}).json()

    # The 4 daily payouts already due were paid; the weekly schedule starts from now.
    assert changed["my_balance"] == 40
    assert changed["allowances"][0]["schedule"]["frequency"] == "weekly"
    assert client.get(f"/markets/{market['id']}").json()["my_balance"] == 40


def test_changing_one_allowance_leaves_the_others_alone(db, member):
    client = member()
    market = create_market(client, allowance("A"), allowance("B")).json()
    first, second = market["allowances"]

    edit(client, market["id"], {**first, "schedule": WEEKLY}, second)
    # A day passes for "B", which kept counting. "A" restarted at the edit.
    unpaid_since(db, days_ago(1))
    db.execute(
        update(Allowance).where(Allowance.id == second["id"]).values(counting_from=days_ago(1))
    )

    paid = notes(client, market["id"])
    assert paid.count("B") == 2
    assert paid.count("A") == 0


def test_renaming_or_changing_the_amount_keeps_counting(db, member):
    client = member()
    market = create_market(client, allowance()).json()
    rewind(db, 1)

    changed = edit(
        client, market["id"], {**market["allowances"][0], "name": "Weekly treat", "amount": 50}
    ).json()

    # What was due was paid first, under the old name and amount.
    assert changed["my_balance"] == 20
    unpaid_since(db, days_ago(1))
    assert notes(client, market["id"]).count("Weekly treat") == 2


def test_adding_and_removing_allowances(member):
    client = member()
    market = create_market(client, allowance("Keep"), allowance("Remove")).json()
    keep, _ = market["allowances"]

    changed = edit(client, market["id"], keep, allowance("New")).json()

    assert [a["name"] for a in changed["allowances"]] == ["Keep", "New"]
    assert changed["allowances"][0]["id"] == keep["id"]


def test_unknown_allowance_id_is_refused(member):
    client = member()
    market_id = create_market(client).json()["id"]

    response = edit(client, market_id, allowance(id=999_999))

    assert response.status_code == 422


def test_time_zone_change_restarts_every_allowance(db, member):
    client = member()
    market_id = create_market(client, allowance("A"), allowance("B")).json()["id"]
    rewind(db, 2)

    paid = client.patch(f"/markets/{market_id}", json={"time_zone": "Asia/Tokyo"}).json()
    unpaid_since(db, days_ago(2))

    assert client.get(f"/markets/{market_id}").json()["my_balance"] == paid["my_balance"]


def test_no_allowance_for_time_away(db, member):
    dana, noa = member("dana_k"), member("noa_r")
    market_id = create_market(dana, allowance()).json()["id"]
    invite_id = dana.post(f"/markets/{market_id}/invites", json={"username": "noa_r"}).json()["id"]
    noa.post(f"/invites/{invite_id}/accept")
    noa.post(f"/markets/{market_id}/leave")
    db.execute(
        update(Membership)
        .where(Membership.left_at.is_not(None))
        .values(left_at=days_ago(20), allowance_paid_until=days_ago(20))
    )
    db.execute(update(Allowance).values(counting_from=days_ago(20)))

    rejoined = noa.post(f"/markets/{market_id}/rejoin").json()

    assert rejoined["my_balance"] == 0


@pytest.mark.parametrize(
    "bad",
    [
        {"amount": 0},
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 51},
        {"schedule": None},
        {"schedule": {"frequency": "weekly", "times": ["09:00"]}},
        {"schedule": {"frequency": "monthly", "times": ["09:00"]}},
        {"schedule": {"frequency": "daily", "times": ["25:00"]}},
        {"schedule": {"frequency": "daily", "times": []}},
        {"schedule": {"frequency": "monthly", "times": ["09:00"], "days": [32]}},
        {"schedule": {"frequency": "weekly", "times": ["09:00"], "weekdays": ["funday"]}},
    ],
)
def test_bad_allowances_are_refused(member, bad):
    assert create_market(member(), allowance(**bad)).status_code == 422


def test_schedule_is_tidied(member):
    schedule = {
        "frequency": "weekly",
        "times": ["21:00", "09:00", "09:00"],
        "weekdays": ["sunday", "monday", "sunday"],
        "days": [5],
    }

    market = create_market(member(), allowance(schedule=schedule)).json()

    assert market["allowances"][0]["schedule"] == {
        "frequency": "weekly",
        "times": ["09:00", "21:00"],
        "weekdays": ["monday", "sunday"],
        "days": [],
    }
