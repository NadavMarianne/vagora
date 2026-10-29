"""Market endpoints: create a market, see your markets, change settings, see your ledger."""

from datetime import datetime
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import AfterValidator, BaseModel, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger
from app.models import EntryKind, LedgerEntry, Market, Membership, User
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets", tags=["markets"])


def known_time_zone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError("Unknown time zone.") from error
    return value


MarketName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
CurrencyName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
# Whole coins only. The upper limit keeps totals far from the database's number limits.
Coins = Annotated[int, Field(ge=0, le=1_000_000_000)]
TimeZone = Annotated[str, AfterValidator(known_time_zone)]


class MarketCreate(BaseModel):
    name: MarketName
    currency_name: CurrencyName
    starting_amount: Coins
    # The app sends the creator's time zone, like "Asia/Jerusalem".
    time_zone: TimeZone
    transfers_enabled: bool = False


class MarketUpdate(BaseModel):
    """Settings to change. Leave out anything that stays the same."""

    name: MarketName | None = None
    currency_name: CurrencyName | None = None
    starting_amount: Coins | None = None
    time_zone: TimeZone | None = None
    transfers_enabled: bool | None = None


class MarketView(BaseModel):
    id: int
    name: str
    currency_name: str
    starting_amount: int
    time_zone: str
    transfers_enabled: bool
    my_balance: int


class EntryView(BaseModel):
    amount: int
    kind: str
    note: str
    created_at: datetime


class MemberView(BaseModel):
    username: str
    display_name: str
    joined_at: datetime
    # Display name of who invited them. Empty for the person who created the market.
    invited_by: str | None


def view(membership: Membership) -> MarketView:
    market = membership.market
    return MarketView(
        id=market.id,
        name=market.name,
        currency_name=market.currency_name,
        starting_amount=market.starting_amount,
        time_zone=market.time_zone,
        transfers_enabled=market.transfers_enabled,
        my_balance=membership.balance,
    )


def get_membership(db: Session, user: User, market_id: int) -> Membership:
    """Your membership in a market. Markets you're not in look the same as ones that don't exist."""
    membership = db.scalar(
        select(Membership).where(Membership.market_id == market_id, Membership.user_id == user.id)
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Market not found.")
    return membership


def add_member(db: Session, market: Market, user: User, invited_by: User | None) -> Membership:
    """Adds someone to a market and gives them its starting amount. The caller commits."""
    membership = Membership(market=market, user=user, invited_by=invited_by)
    db.add(membership)
    db.flush()
    if market.starting_amount > 0:
        ledger.record(
            db, membership, market.starting_amount, EntryKind.STARTING_AMOUNT, "Starting amount"
        )
    return membership


@router.post("", status_code=status.HTTP_201_CREATED)
def create_market(new: MarketCreate, user: CurrentUser, db: DbSession) -> MarketView:
    """Creates a market. You become its first member and get its starting amount."""
    market = Market(**new.model_dump())
    db.add(market)
    membership = add_member(db, market, user, invited_by=None)
    db.commit()
    return view(membership)


@router.get("")
def list_my_markets(user: CurrentUser, db: DbSession) -> list[MarketView]:
    memberships = db.scalars(
        select(Membership).where(Membership.user_id == user.id).order_by(Membership.joined_at)
    )
    return [view(membership) for membership in memberships]


@router.get("/{market_id}")
def get_market(market_id: int, user: CurrentUser, db: DbSession) -> MarketView:
    return view(get_membership(db, user, market_id))


@router.patch("/{market_id}")
def change_settings(
    market_id: int, changes: MarketUpdate, user: CurrentUser, db: DbSession
) -> MarketView:
    """Any member can change the settings (all members are equal)."""
    membership = get_membership(db, user, market_id)
    for setting, value in changes.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(membership.market, setting, value)
    db.commit()
    return view(membership)


@router.get("/{market_id}/members")
def list_members(market_id: int, user: CurrentUser, db: DbSession) -> list[MemberView]:
    """Everyone in the market and who invited them. Other people's balances stay private."""
    membership = get_membership(db, user, market_id)
    members = db.scalars(
        select(Membership)
        .where(Membership.market_id == membership.market_id)
        .order_by(Membership.joined_at, Membership.id)
    )
    return [
        MemberView(
            username=m.user.username,
            display_name=m.user.display_name,
            joined_at=m.joined_at,
            invited_by=m.invited_by.display_name if m.invited_by else None,
        )
        for m in members
    ]


@router.get("/{market_id}/ledger")
def my_ledger(
    market_id: int,
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[EntryView]:
    """Your recent coin movements in this market, newest first."""
    membership = get_membership(db, user, market_id)
    entries = db.scalars(
        select(LedgerEntry)
        .where(LedgerEntry.membership_id == membership.id)
        .order_by(LedgerEntry.created_at.desc(), LedgerEntry.id.desc())
        .limit(limit)
    )
    return [
        EntryView(amount=e.amount, kind=e.kind, note=e.note, created_at=e.created_at)
        for e in entries
    ]
