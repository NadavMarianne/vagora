"""Allowances: scheduled coins for members, paid by catching up (see decision 0017).

A market can have any number of allowances, each with its own name, amount, and schedule
(daily, weekly, monthly, yearly, or once). Each goes to everyone or only to chosen members, and
can be valid only from or until a day (decided 2026-11-27). Nothing runs on a timer. Whenever a
market is used, every member gets the payouts that came due since they were last paid, each
dated with its scheduled time and named after its allowance.
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
# "MM-DD": a day of the year, for yearly allowances.
DayOfYear = Annotated[str, StringConstraints(pattern=r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")]
# "YYYY-MM-DD".
Day = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]
AllowanceName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
]
# Whole coins, at least 1. The upper limit keeps totals far from the database's number limits.
AllowanceAmount = Annotated[int, Field(ge=1, le=1_000_000_000)]


class AllowanceSchedule(BaseModel):
    """When an allowance is paid. Times are in the market's time zone."""

    frequency: Literal["daily", "weekly", "monthly", "yearly", "once"]
    times: list[ClockTime] = Field(min_length=1, max_length=24)
    # Weekly only: which days of the week.
    weekdays: list[Weekday] = []
    # Monthly only: which dates. A date a month doesn't have (like the 31st) means its last day.
    days: list[DayOfMonth] = []
    # Yearly only: which days of the year, like "12-11". February 29th means the 28th in other
    # years.
    dates: list[DayOfYear] = []
    # Once only: the day it's paid.
    on: Day | None = None

    @model_validator(mode="after")
    def fits_frequency(self) -> Self:
        if self.frequency == "weekly" and not self.weekdays:
            raise ValueError("A weekly allowance needs at least one weekday.")
        if self.frequency == "monthly" and not self.days:
            raise ValueError("A monthly allowance needs at least one date.")
        if self.frequency == "yearly":
            if not self.dates:
                raise ValueError("A yearly allowance needs at least one date.")
            for day in self.dates:
                # A real day of the year (checked in a leap year, so February 29th counts).
                real_day(f"2024-{day}")
        if self.frequency == "once":
            if self.on is None:
                raise ValueError("A one-time allowance needs a date.")
            real_day(self.on)
        # Keep only what this frequency uses, sorted and without repeats.
        self.times = sorted(set(self.times))
        self.weekdays = (
            sorted(set(self.weekdays), key=WEEKDAYS.index) if self.frequency == "weekly" else []
        )
        self.days = sorted(set(self.days)) if self.frequency == "monthly" else []
        self.dates = sorted(set(self.dates)) if self.frequency == "yearly" else []
        self.on = self.on if self.frequency == "once" else None
        return self


def real_day(text: str) -> date:
    """A "YYYY-MM-DD" day, or a clear error if there's no such day."""
    try:
        return date.fromisoformat(text)
    except ValueError:
        raise ValueError(f"{text} isn't a real date.") from None


class AllowanceIn(BaseModel):
    """An allowance as the app sends it. Without an `id` it's a new one."""

    id: int | None = None
    name: AllowanceName
    amount: AllowanceAmount
    enabled: bool = True
    schedule: AllowanceSchedule
    # Who gets it, by username. None means everyone, including people who join later.
    recipients: list[str] | None = Field(default=None, min_length=1)
    # Valid only from and until these days (both included), in the market's time zone. None
    # means no limit: by default an allowance starts now and never ends.
    starts_on: Day | None = None
    ends_on: Day | None = None

    @model_validator(mode="after")
    def valid_period(self) -> Self:
        start = real_day(self.starts_on) if self.starts_on else None
        end = real_day(self.ends_on) if self.ends_on else None
        if start and end and end < start:
            raise ValueError("An allowance can't end before it starts.")
        return self


class AllowanceView(BaseModel):
    id: int
    name: str
    amount: int
    enabled: bool
    schedule: AllowanceSchedule
    recipients: list[str] | None
    starts_on: str | None
    ends_on: str | None
    # It won't pay anymore: its last valid day has passed, or a one-time one was paid.
    ended: bool


def allowance_view(allowance: Allowance) -> AllowanceView:
    market = allowance.market
    names = {m.user_id: m.user.username for m in market.memberships}
    return AllowanceView(
        id=allowance.id,
        name=allowance.name,
        amount=allowance.amount,
        enabled=allowance.enabled,
        schedule=AllowanceSchedule(**allowance.schedule),
        recipients=(
            None
            if allowance.recipients is None
            else [names[i] for i in allowance.recipients if i in names]
        ),
        starts_on=allowance.starts_on.isoformat() if allowance.starts_on else None,
        ends_on=allowance.ends_on.isoformat() if allowance.ends_on else None,
        ended=has_ended(allowance, market.time_zone),
    )


def has_ended(allowance: Allowance, time_zone: str) -> bool:
    """Whether an allowance won't pay anymore: no payout is left after now."""
    zone = ZoneInfo(time_zone)
    now = datetime.now(UTC)
    if allowance.schedule["frequency"] == "once":
        day = date.fromisoformat(allowance.schedule["on"])
        end_of_day = datetime.combine(day, time.max, tzinfo=zone)
        return not payout_times(
            allowance.schedule,
            time_zone,
            now,
            end_of_day,
            allowance.starts_on,
            allowance.ends_on,
        )
    return allowance.ends_on is not None and now.astimezone(zone).date() > allowance.ends_on


class UnknownAllowance(ValueError):
    """The app referred to an allowance this market doesn't have."""


def is_payday(schedule: dict, day: date) -> bool:
    frequency = schedule["frequency"]
    if frequency == "daily":
        return True
    if frequency == "weekly":
        return WEEKDAYS[day.weekday()] in schedule["weekdays"]
    if frequency == "once":
        return day.isoformat() == schedule.get("on")
    if frequency == "yearly":
        dates = schedule.get("dates", [])
        if day.strftime("%m-%d") in dates:
            return True
        # February 29th, in a year without one, means the 28th.
        leap_day = day.month == 2 and day.day == 28 and not calendar.isleap(day.year)
        return leap_day and "02-29" in dates
    last_day = calendar.monthrange(day.year, day.month)[1]
    if day.day in schedule["days"]:
        return True
    return day.day == last_day and any(d > last_day for d in schedule["days"])


def payout_times(
    schedule: dict,
    time_zone: str,
    after: datetime,
    until: datetime,
    starts_on: date | None = None,
    ends_on: date | None = None,
) -> list[datetime]:
    """Every scheduled payout after `after` and up to and including `until`, in UTC, on days
    from `starts_on` to `ends_on` (in the market's time zone) when those are set."""
    zone = ZoneInfo(time_zone)
    clock_times = [time.fromisoformat(t) for t in schedule["times"]]
    found = set()
    day = after.astimezone(zone).date()
    last = until.astimezone(zone).date()
    if starts_on is not None:
        day = max(day, starts_on)
    if ends_on is not None:
        last = min(last, ends_on)
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
                if allowance.recipients is None or membership.user_id in allowance.recipients
                for moment in payout_times(
                    allowance.schedule,
                    market.time_zone,
                    max(last_paid, allowance.counting_from),
                    until,
                    allowance.starts_on,
                    allowance.ends_on,
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
    An allowance whose timing, people or valid days changed, or that was switched on, starts
    fresh from now, so nothing from before is paid. Renaming it or changing its amount doesn't.
    """
    now = datetime.now(UTC)
    current = {allowance.id: allowance for allowance in market.allowances}
    # People are chosen among the market's current members.
    ids = {m.user.username: m.user_id for m in market.memberships if m.left_at is None}
    kept: list[Allowance] = []
    for item in wanted:
        schedule = item.schedule.model_dump()
        recipients = None
        if item.recipients is not None:
            unknown = [name for name in item.recipients if name not in ids]
            if unknown:
                raise UnknownAllowance(f"{unknown[0]} isn't in this market.")
            recipients = sorted({ids[name] for name in item.recipients})
        starts_on = date.fromisoformat(item.starts_on) if item.starts_on else None
        ends_on = date.fromisoformat(item.ends_on) if item.ends_on else None
        if item.id is None:
            kept.append(
                Allowance(
                    name=item.name,
                    amount=item.amount,
                    enabled=item.enabled,
                    schedule=schedule,
                    recipients=recipients,
                    starts_on=starts_on,
                    ends_on=ends_on,
                    counting_from=now,
                )
            )
            continue
        allowance = current.pop(item.id, None)
        if allowance is None:
            raise UnknownAllowance("One of these allowances isn't in this market.")
        if (
            allowance.schedule != schedule
            or allowance.recipients != recipients
            or allowance.starts_on != starts_on
            or allowance.ends_on != ends_on
            or (item.enabled and not allowance.enabled)
        ):
            allowance.counting_from = now
        allowance.name = item.name
        allowance.amount = item.amount
        allowance.enabled = item.enabled
        allowance.schedule = schedule
        allowance.recipients = recipients
        allowance.starts_on = starts_on
        allowance.ends_on = ends_on
        kept.append(allowance)
    # Anything not in the list is removed (delete-orphan on Market.allowances).
    market.allowances = kept
