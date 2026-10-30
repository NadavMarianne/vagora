"""Allowances: scheduled coins for every member, paid by catching up (see decision 0017).

A market can have any number of allowances, each with its own name, amount, and schedule.
Nothing runs on a timer. Whenever a market is used, every member gets the payouts that came
due since they were last paid, each dated with its scheduled time and named after its allowance.
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
from app.models import Allowance, EntryKind, Market, Membership

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# "HH:MM" on a 24-hour clock, in the market's time zone.
ClockTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
Weekday = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DayOfMonth = Annotated[int, Field(ge=1, le=31)]
AllowanceName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
]
# Whole coins, at least 1. The upper limit keeps totals far from the database's number limits.
AllowanceAmount = Annotated[int, Field(ge=1, le=1_000_000_000)]


class AllowanceSchedule(BaseModel):
    """When an allowance is paid. Times are in the market's time zone."""

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


class AllowanceIn(BaseModel):
    """An allowance as the app sends it. Without an `id` it's a new one."""

    id: int | None = None
    name: AllowanceName
    amount: AllowanceAmount
    enabled: bool = True
    schedule: AllowanceSchedule


class AllowanceView(BaseModel):
    id: int
    name: str
    amount: int
    enabled: bool
    schedule: AllowanceSchedule


def allowance_view(allowance: Allowance) -> AllowanceView:
    return AllowanceView(
        id=allowance.id,
        name=allowance.name,
        amount=allowance.amount,
        enabled=allowance.enabled,
        schedule=AllowanceSchedule(**allowance.schedule),
    )


class UnknownAllowance(ValueError):
    """The app referred to an allowance this market doesn't have."""


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
    allowances = [a for a in market.allowances if a.enabled]
    if not allowances:
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
        due = sorted(
            (
                (moment, allowance)
                for allowance in allowances
                for moment in payout_times(
                    allowance.schedule,
                    market.time_zone,
                    max(last_paid, allowance.counting_from),
                    until,
                )
            ),
            key=lambda payout: (payout[0], payout[1].id),
        )
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
        for moment, allowance in due:
            ledger.record(
                db, membership, allowance.amount, EntryKind.ALLOWANCE, allowance.name, at=moment
            )
        paid = True
    return paid


def restart_all(market: Market) -> None:
    """After the market's time zone changes, every allowance counts from now."""
    now = datetime.now(UTC)
    for allowance in market.allowances:
        allowance.counting_from = now


def replace_allowances(market: Market, wanted: list[AllowanceIn]) -> None:
    """Makes the market's allowances match the list the app sent. The caller commits.

    Allowances with an `id` are updated, ones without are added, and missing ones are removed.
    An allowance whose timing changed, or that was switched on, starts fresh from now. Renaming
    it or changing its amount doesn't.
    """
    now = datetime.now(UTC)
    current = {allowance.id: allowance for allowance in market.allowances}
    kept: list[Allowance] = []
    for item in wanted:
        schedule = item.schedule.model_dump()
        if item.id is None:
            kept.append(
                Allowance(
                    name=item.name,
                    amount=item.amount,
                    enabled=item.enabled,
                    schedule=schedule,
                    counting_from=now,
                )
            )
            continue
        allowance = current.pop(item.id, None)
        if allowance is None:
            raise UnknownAllowance("One of these allowances isn't in this market.")
        if allowance.schedule != schedule or (item.enabled and not allowance.enabled):
            allowance.counting_from = now
        allowance.name = item.name
        allowance.amount = item.amount
        allowance.enabled = item.enabled
        allowance.schedule = schedule
        kept.append(allowance)
    # Anything not in the list is removed (delete-orphan on Market.allowances).
    market.allowances = kept
