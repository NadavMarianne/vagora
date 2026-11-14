"""Playing hands at a poker table (decision 0030).

Any player at the table deals the next hand. On your turn you fold, check, call, raise or go
all-in. At a showdown, someone still in the hand says who won each pot, and everyone else still
in the hand confirms it (or rejects it, so someone can say again). The rules are in app/poker.py.
"""

import copy
from typing import Annotated, Literal

from fastapi import APIRouter, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import hand_state, poker, tables
from app.markets import get_membership
from app.models import PokerHand, PokerTable, User
from app.tables import TableView, conflict
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets/{market_id}/tables/{table_id}/hands", tags=["games"])


class ActBody(BaseModel):
    action: Literal["fold", "check", "call", "raise", "all_in"]
    # For a raise: the bet's new total in this round.
    amount: Annotated[int, Field(ge=1)] | None = None


class ClaimBody(BaseModel):
    # Who won each contested pot, in order (several seats split it).
    winners: list[list[Annotated[int, Field(ge=0, le=8)]]]


def open_table(db: Session, user: User, market_id: int, table_id: int) -> PokerTable:
    """The table, locked for this action, with any run-out turns applied."""
    get_membership(db, user, market_id)
    table = tables.get_table(db, market_id, table_id, lock=True)
    hand_state.catch_up(db, table)
    return table


def playing(db: Session, table: PokerTable) -> tuple[PokerHand, poker.Hand]:
    row = hand_state.current(db, table)
    if row is None:
        raise conflict("No hand is being played. Deal the next one.")
    return row, poker.Hand.from_data(row.state)


def my_number(row: PokerHand, table: PokerTable, user: User) -> int:
    """Your seat number in this hand."""
    seat = next((s for s in tables.seated(table) if s.user_id == user.id), None)
    if seat is None or row.seat_ids.get(str(seat.number)) != seat.id:
        raise conflict("You're not in this hand.")
    return seat.number


def done(db: Session, market_id: int, table: PokerTable, user: User) -> TableView:
    tables.changed(db, market_id, user)
    return tables.view(table, user, db)


@router.post("", status_code=status.HTTP_201_CREATED)
def deal(market_id: int, table_id: int, user: CurrentUser, db: DbSession) -> TableView:
    """Starts the next hand: moves the button and posts the blinds. Anyone sitting here can."""
    table = open_table(db, user, market_id, table_id)
    if not any(s.user_id == user.id for s in tables.seated(table)):
        raise conflict("You're not sitting at this table.")
    if hand_state.current(db, table) is not None:
        raise conflict("A hand is already being played.")
    seats = tables.seated(table)
    try:
        hand = poker.start({s.number: s.stack for s in seats}, table.button_seat, table.small_blind)
    except poker.NotAllowed as error:
        raise conflict(str(error)) from error

    number = (
        db.scalar(select(func.max(PokerHand.number)).where(PokerHand.table_id == table.id)) or 0
    ) + 1
    row = PokerHand(
        table_id=table.id,
        number=number,
        state={},
        seat_ids={str(s.number): s.id for s in seats if s.number in {p.seat for p in hand.players}},
    )
    db.add(row)
    db.flush()
    hand_state.save(db, row, hand)
    table.button_seat = hand.button
    return done(db, market_id, table, user)


@router.post("/current/act")
def act(
    market_id: int, table_id: int, body: ActBody, user: CurrentUser, db: DbSession
) -> TableView:
    """Your action, on your turn."""
    table = open_table(db, user, market_id, table_id)
    row, hand = playing(db, table)
    seat = my_number(row, table, user)
    try:
        poker.act(hand, seat, body.action, body.amount)
    except poker.NotAllowed as error:
        raise conflict(str(error)) from error
    hand_state.save(db, row, hand)
    return done(db, market_id, table, user)


@router.post("/current/claim")
def claim(
    market_id: int, table_id: int, body: ClaimBody, user: CurrentUser, db: DbSession
) -> TableView:
    """At the showdown: says who won each pot. Everyone else still in the hand must confirm.
    A new claim replaces an earlier one."""
    table = open_table(db, user, market_id, table_id)
    row, hand = playing(db, table)
    seat = my_number(row, table, user)
    if hand.street != "showdown":
        raise conflict("The hand isn't at the showdown.")
    if hand.player(seat).folded:
        raise conflict("You folded this hand.")
    try:
        poker.settle(copy.deepcopy(hand), body.winners)  # only to check it's possible
    except poker.NotAllowed as error:
        raise conflict(str(error)) from error
    row.claim = {"by": seat, "winners": body.winners, "confirmed": [seat]}
    agreed(db, row, hand)
    return done(db, market_id, table, user)


@router.post("/current/confirm")
def confirm(market_id: int, table_id: int, user: CurrentUser, db: DbSession) -> TableView:
    """Agrees with who someone said won."""
    table = open_table(db, user, market_id, table_id)
    row, hand = playing(db, table)
    seat = my_number(row, table, user)
    if row.claim is None:
        raise conflict("Nobody said who won yet.")
    if hand.player(seat).folded:
        raise conflict("You folded this hand.")
    if seat not in row.claim["confirmed"]:
        row.claim = {**row.claim, "confirmed": [*row.claim["confirmed"], seat]}
    agreed(db, row, hand)
    return done(db, market_id, table, user)


@router.post("/current/reject")
def reject(market_id: int, table_id: int, user: CurrentUser, db: DbSession) -> TableView:
    """Disagrees with who someone said won, so it can be said again."""
    table = open_table(db, user, market_id, table_id)
    row, hand = playing(db, table)
    seat = my_number(row, table, user)
    if row.claim is None:
        raise conflict("Nobody said who won yet.")
    if hand.player(seat).folded:
        raise conflict("You folded this hand.")
    row.claim = None
    return done(db, market_id, table, user)


def agreed(db: Session, row: PokerHand, hand: poker.Hand) -> None:
    """Pays out the pots once everyone still in the hand agrees with the claim."""
    still_in = {p.seat for p in hand.in_hand()}
    if row.claim is None or not still_in <= set(row.claim["confirmed"]):
        return
    poker.settle(hand, row.claim["winners"])
    hand_state.save(db, row, hand)


def fold_out(db: Session, table: PokerTable, user: User) -> None:
    """Takes someone who's leaving the market out of the hand being played at this table."""
    row = hand_state.current(db, table)
    seat = next((s for s in tables.seated(table) if s.user_id == user.id), None)
    if row is None or seat is None or row.seat_ids.get(str(seat.number)) != seat.id:
        return
    hand = poker.Hand.from_data(row.state)
    poker.fold_out(hand, seat.number)
    if row.claim is not None and hand.street == "showdown":
        row.claim = None
    hand_state.save(db, row, hand)
