"""Games: poker tables and seats (decision 0030).

The cards are real; the table holds the chips. Sitting down moves your buy-in from your balance
onto the table, topping up adds more (only up to the maximum buy-in), and leaving brings your
whole stack back. Winnings aren't capped, so a stack can grow past the maximum. Hands come in
app/poker.py.
"""

from datetime import UTC, datetime
from typing import Annotated, Self

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger, signals
from app.markets import get_membership
from app.models import EntryKind, Membership, PokerSeat, PokerTable, User
from app.store import Price
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets/{market_id}/tables", tags=["games"])

TableName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
# The usual buy-ins when a table doesn't set its own: 20 to 100 big blinds.
DEFAULT_MIN_BIG_BLINDS = 20
DEFAULT_MAX_BIG_BLINDS = 100


def now() -> datetime:
    return datetime.now(UTC)


def conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


class TableSettings(BaseModel):
    name: TableName
    max_players: Annotated[int, Field(ge=2, le=9)] = 9
    small_blind: Annotated[int, Field(ge=1, le=10_000_000)]
    # Without these, 20 and 100 big blinds.
    min_buy_in: Price | None = None
    max_buy_in: Price | None = None
    # Seconds per turn. Empty: no timer.
    turn_seconds: Annotated[int, Field(ge=5, le=3600)] | None = None

    @model_validator(mode="after")
    def buy_ins_in_order(self) -> Self:
        big_blind = 2 * self.small_blind
        if self.min_buy_in is None:
            self.min_buy_in = DEFAULT_MIN_BIG_BLINDS * big_blind
        if self.max_buy_in is None:
            self.max_buy_in = max(DEFAULT_MAX_BIG_BLINDS * big_blind, self.min_buy_in)
        if self.min_buy_in < big_blind:
            raise ValueError("The minimum buy-in must be at least one big blind.")
        if self.max_buy_in < self.min_buy_in:
            raise ValueError("The maximum buy-in can't be below the minimum.")
        return self


class SitDown(BaseModel):
    buy_in: Price
    # Which seat, 0 to 8. Empty: the first free one.
    seat: Annotated[int, Field(ge=0, le=8)] | None = None


class TopUp(BaseModel):
    amount: Price


class SeatView(BaseModel):
    number: int
    username: str
    display_name: str
    stack: int


class TableView(BaseModel):
    id: int
    name: str
    creator_username: str
    max_players: int
    small_blind: int
    big_blind: int
    min_buy_in: int
    max_buy_in: int
    turn_seconds: int | None
    seats: list[SeatView]
    # Your seat number, if you're sitting here.
    my_seat: int | None


def seated(table: PokerTable) -> list[PokerSeat]:
    """The players sitting at the table now, by seat number."""
    return [seat for seat in table.seats if seat.left_at is None]


def view(table: PokerTable, user: User) -> TableView:
    seats = seated(table)
    return TableView(
        id=table.id,
        name=table.name,
        creator_username=table.creator.username,
        max_players=table.max_players,
        small_blind=table.small_blind,
        big_blind=2 * table.small_blind,
        min_buy_in=table.min_buy_in,
        max_buy_in=table.max_buy_in,
        turn_seconds=table.turn_seconds,
        seats=[
            SeatView(
                number=s.number,
                username=s.user.username,
                display_name=s.user.display_name,
                stack=s.stack,
            )
            for s in seats
        ],
        my_seat=next((s.number for s in seats if s.user_id == user.id), None),
    )


def get_table(db: Session, market_id: int, table_id: int, lock: bool = False) -> PokerTable:
    """An open table in this market. `lock` holds it until the transaction ends, so two
    actions at the same table happen one after the other."""
    query = select(PokerTable).where(
        PokerTable.id == table_id,
        PokerTable.market_id == market_id,
        PokerTable.closed_at.is_(None),
    )
    if lock:
        query = query.with_for_update()
    table = db.scalar(query)
    if table is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Table not found.")
    if lock:
        db.refresh(table, ["seats"])
    return table


def my_seat(table: PokerTable, user: User) -> PokerSeat:
    seat = next((s for s in seated(table) if s.user_id == user.id), None)
    if seat is None:
        raise conflict("You're not sitting at this table.")
    return seat


def take_coins(db: Session, membership: Membership, amount: int, table: PokerTable) -> None:
    try:
        ledger.record(db, membership, -amount, EntryKind.TABLE_BUY_IN, f"Chips at {table.name}")
    except ledger.NotEnoughCoins as error:
        db.rollback()
        raise conflict("You don't have enough coins.") from error


def cash_out(db: Session, seat: PokerSeat) -> None:
    """Brings a seat's whole stack back to the player's balance and frees the seat."""
    if seat.stack > 0:
        note = f"Left {seat.table.name}"
        ledger.record(db, seat.membership, seat.stack, EntryKind.TABLE_CASH_OUT, note)
    seat.stack = 0
    seat.left_at = now()


def leave_all(db: Session, market_id: int, user_id: int) -> None:
    """Gets up from every table in the market (when leaving it). The caller commits."""
    seats = db.scalars(
        select(PokerSeat)
        .join(PokerTable)
        .where(
            PokerTable.market_id == market_id,
            PokerSeat.user_id == user_id,
            PokerSeat.left_at.is_(None),
        )
        .with_for_update(of=PokerSeat)
    )
    for seat in seats:
        cash_out(db, seat)


def changed(db: Session, market_id: int, user: User) -> None:
    """Saves, and tells everyone else in the market so open table screens reload."""
    db.commit()
    signals.notify_market(db, market_id, but=user)


@router.get("")
def list_tables(market_id: int, user: CurrentUser, db: DbSession) -> list[TableView]:
    """The market's open tables, newest first."""
    get_membership(db, user, market_id)
    tables = db.scalars(
        select(PokerTable)
        .where(PokerTable.market_id == market_id, PokerTable.closed_at.is_(None))
        .order_by(PokerTable.created_at.desc(), PokerTable.id.desc())
    )
    return [view(table, user) for table in tables]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_table(
    market_id: int, settings: TableSettings, user: CurrentUser, db: DbSession
) -> TableView:
    """Opens a new table. Anyone in the market can."""
    get_membership(db, user, market_id)
    table = PokerTable(market_id=market_id, creator=user, **settings.model_dump())
    db.add(table)
    changed(db, market_id, user)
    return view(table, user)


@router.get("/{table_id}")
def get_table_view(market_id: int, table_id: int, user: CurrentUser, db: DbSession) -> TableView:
    get_membership(db, user, market_id)
    return view(get_table(db, market_id, table_id), user)


@router.put("/{table_id}")
def change_settings(
    market_id: int, table_id: int, settings: TableSettings, user: CurrentUser, db: DbSession
) -> TableView:
    """Changes a table's settings. Only whoever opened it. Stacks stay as they are, even above a
    lower maximum."""
    get_membership(db, user, market_id)
    table = get_table(db, market_id, table_id, lock=True)
    if table.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only whoever opened the table can.")
    if settings.max_players < len(seated(table)):
        raise conflict("More players are sitting here than that.")
    if any(s.number >= settings.max_players for s in seated(table)):
        raise conflict("Someone is sitting in a seat that wouldn't exist any more.")
    for key, value in settings.model_dump().items():
        setattr(table, key, value)
    changed(db, market_id, user)
    return view(table, user)


@router.post("/{table_id}/sit")
def sit_down(
    market_id: int, table_id: int, body: SitDown, user: CurrentUser, db: DbSession
) -> TableView:
    """Sits down with a buy-in, which moves from your balance onto the table."""
    membership = get_membership(db, user, market_id)
    table = get_table(db, market_id, table_id, lock=True)
    taken = {s.number for s in seated(table)}
    if any(s.user_id == user.id for s in seated(table)):
        raise conflict("You're already sitting here.")
    if not table.min_buy_in <= body.buy_in <= table.max_buy_in:
        raise conflict(f"The buy-in is {table.min_buy_in} to {table.max_buy_in}.")
    free = [n for n in range(table.max_players) if n not in taken]
    if not free:
        raise conflict("The table is full.")
    number = body.seat if body.seat is not None else free[0]
    if number not in free:
        raise conflict("That seat isn't free.")

    take_coins(db, membership, body.buy_in, table)
    db.add(
        PokerSeat(table=table, user=user, membership=membership, number=number, stack=body.buy_in)
    )
    changed(db, market_id, user)
    db.refresh(table, ["seats"])
    return view(table, user)


@router.post("/{table_id}/top-up")
def top_up(
    market_id: int, table_id: int, body: TopUp, user: CurrentUser, db: DbSession
) -> TableView:
    """Adds coins to your stack, up to the maximum buy-in."""
    membership = get_membership(db, user, market_id)
    table = get_table(db, market_id, table_id, lock=True)
    seat = my_seat(table, user)
    room = table.max_buy_in - seat.stack
    if room <= 0:
        raise conflict("Your stack is already at the maximum buy-in or above.")
    if body.amount > room:
        raise conflict(f"You can add up to {room}.")

    take_coins(db, membership, body.amount, table)
    seat.stack += body.amount
    changed(db, market_id, user)
    return view(table, user)


@router.post("/{table_id}/leave")
def leave_table(market_id: int, table_id: int, user: CurrentUser, db: DbSession) -> TableView:
    """Gets up. Your whole stack goes back to your balance."""
    get_membership(db, user, market_id)
    table = get_table(db, market_id, table_id, lock=True)
    cash_out(db, my_seat(table, user))
    changed(db, market_id, user)
    db.refresh(table, ["seats"])
    return view(table, user)


@router.post("/{table_id}/close", status_code=status.HTTP_204_NO_CONTENT)
def close_table(market_id: int, table_id: int, user: CurrentUser, db: DbSession) -> None:
    """Closes an empty table. Only whoever opened it."""
    get_membership(db, user, market_id)
    table = get_table(db, market_id, table_id, lock=True)
    if table.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only whoever opened the table can.")
    if seated(table):
        raise conflict("Players are still sitting here.")
    table.closed_at = now()
    changed(db, market_id, user)
