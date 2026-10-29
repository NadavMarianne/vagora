"""The allowance: scheduled coins for every member, paid by catching up (see decision 0017).

Nothing runs on a timer. Whenever a market is used, every member gets the payouts that came
due since they were last paid, each dated with its scheduled time.
"""

import calendar
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated, Literal, Self
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, StringConstraints, model_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value

from app import ledger
from app.models import EntryKind, Market, Membership

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# "HH:MM" on a 24-hour clock, in the market's time zone.
ClockTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
Weekday = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DayOfMonth = Annotated[int, Field(ge=1, le=31)]


class AllowanceSchedule(BaseModel):
    """When the allowance is paid. Times are in the market's time zone."""

    frequency: Literal["daily", "weekly", "monthly"]
    times: list[ClockTime] = Field(min_length=1, max_length=24)
    # Weekly only: which days of the week.
    weekdays: list[Weekday] = []
    # Monthly only: which dates. A date a month doesn't have (like the 31st) means its last day.
    days: list[DayOfMonth] = []

    @model_validator(mode="after")
    def fits_frequency(self) -> Self:
        if self.frequency == "weekly" and not self.weekdays:
            raise ValueError("A weekly allowance needs at least one weekday.")
        if self.frequency == "monthly" and not self.days:
            raise ValueError("A monthly allowance needs at least one date.")
        # Keep only what this frequency uses, sorted and without repeats.
        self.times = sorted(set(self.times))
        self.weekdays = (
            sorted(set(self.weekdays), key=WEEKDAYS.index) if self.frequency == "weekly" else []
        )
        self.days = sorted(set(self.days)) if self.frequency == "monthly" else []
        return self


def is_payday(schedule: dict, day: date) -> bool:
    frequency = schedule["frequency"]
    if frequency == "daily":
        return True
    if frequency == "weekly":
        return WEEKDAYS[day.weekday()] in schedule["weekdays"]
    last_day = calendar.monthrange(day.year, day.month)[1]
    if day.day in schedule["days"]:
        return True
    return day.day == last_day and any(d > last_day for d in schedule["days"])


def payout_times(
    schedule: dict, time_zone: str, after: datetime, until: datetime
) -> list[datetime]:
    """Every scheduled payout after `after` and up to and including `until`, in UTC."""
    zone = ZoneInfo(time_zone)
    clock_times = [time.fromisoformat(t) for t in schedule["times"]]
    found = set()
    day = after.astimezone(zone).date()
    last = until.astimezone(zone).date()
    while day <= last:
        if is_payday(schedule, day):
            for clock_time in clock_times:
                moment = datetime.combine(day, clock_time, tzinfo=zone).astimezone(UTC)
                if after < moment <= until:
                    found.add(moment)
        day += timedelta(days=1)
    return sorted(found)


def pay_due(db: Session, market: Market) -> bool:
    """Pays every current member the allowances due since they were last paid.

    Returns True if anything was paid, so the caller knows to commit.
    """
    if not market.allowance_enabled:
        return False
    until = datetime.now(UTC)
    paid = False
    members = db.scalars(
        select(Membership)
        .where(Membership.market_id == market.id, Membership.left_at.is_(None))
        .execution_options(populate_existing=True)
    )
    for membership in members:
        last_paid = membership.allowance_paid_until
        due = payout_times(market.allowance_schedule, market.time_zone, last_paid, until)
        if not due:
            continue
        # Claim these payouts. If another request claimed them at the same moment, it pays them.
        claimed = db.execute(
            update(Membership)
            .where(Membership.id == membership.id, Membership.allowance_paid_until == last_paid)
            .values(allowance_paid_until=until)
            .execution_options(synchronize_session=False)
        )
        if claimed.rowcount == 0:
            continue
        set_committed_value(membership, "allowance_paid_until", until)
        for moment in due:
            ledger.record(
                db, membership, market.allowance_amount, EntryKind.ALLOWANCE, "Allowance", at=moment
            )
        paid = True
    return paid


def start_fresh(db: Session, market: Market) -> None:
    """Starts every current member's allowance from now, after a change to it.

    Payouts already due were paid just before the change; nothing from before now is paid again.
    """
    db.execute(
        update(Membership)
        .where(Membership.market_id == market.id, Membership.left_at.is_(None))
        .values(allowance_paid_until=datetime.now(UTC))
        .execution_options(synchronize_session=False)
    )
