"""Saving and showing poker hands (decision 0030). The rules themselves are in app/poker.py.

A hand's state is stored as plain data. While a hand is played, each player's stack on their
seat is kept equal to their stack in the hand, so the table always shows the real chips.
"""

from datetime import UTC, datetime, timedelta

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import poker
from app.models import PokerHand, PokerSeat, PokerTable, User


def now() -> datetime:
    return datetime.now(UTC)


def current(db: Session, table: PokerTable) -> PokerHand | None:
    """The hand being played at the table, if there is one."""
    return db.scalar(
        select(PokerHand).where(PokerHand.table_id == table.id, PokerHand.finished_at.is_(None))
    )


def latest(db: Session, table: PokerTable) -> PokerHand | None:
    """The hand being played, or else the last one (to show how it ended)."""
    return db.scalar(
        select(PokerHand)
        .where(PokerHand.table_id == table.id)
        .order_by(PokerHand.number.desc())
        .limit(1)
    )


def in_current_hand(db: Session, table: PokerTable, seat: PokerSeat) -> bool:
    row = current(db, table)
    return (
        row is not None
        and str(seat.number) in row.seat_ids
        and (row.seat_ids[str(seat.number)] == seat.id)
    )


def save(
    db: Session, row: PokerHand, hand: poker.Hand, table: PokerTable, at: datetime | None = None
) -> None:
    """Stores the hand's new state and copies its stacks onto the seats.

    A new turn restarts the turn timer, from `at` (when a turn ran out) or now. With a timer, a
    new betting round first waits for its cards to be dealt.
    """
    street_before = row.state["street"] if row.state else None
    # Every action starts a new turn, even when the same player acts next (heads-up, the big
    # blind can end one round and start the next).
    actions_before = len(row.state["log"]) if row.state else -1
    row.state = hand.to_data()
    if len(hand.log) != actions_before or at is not None:
        row.turn_started_at = at or now()
    if (
        table.turn_seconds is not None
        and hand.street != street_before
        and hand.street in poker.BETTING
        and hand.to_act is not None
    ):
        row.waiting_for_cards = True
    for player in hand.players:
        seat = db.get(PokerSeat, row.seat_ids[str(player.seat)])
        # A player who already got up keeps what they took with them.
        if seat is not None and seat.left_at is None:
            seat.stack = player.stack
    if hand.street == "done":
        row.finished_at = now()
        row.claim = None
    db.flush()


def catch_up(db: Session, table: PokerTable) -> bool:
    """Applies the turn timer: every turn that ran out checks if it can, or folds.
    Returns whether any did, so the other players can be told."""
    row = current(db, table)
    if row is None or table.turn_seconds is None:
        return False
    limit = timedelta(seconds=table.turn_seconds)
    hand = poker.Hand.from_data(row.state)
    ran = False
    while (
        hand.to_act is not None
        and not row.waiting_for_cards
        and row.turn_started_at + limit <= now()
    ):
        ran_out = row.turn_started_at + limit
        poker.time_out(hand)
        save(db, row, hand, table, at=ran_out)
        ran = True
    return ran


class PotView(BaseModel):
    amount: int
    eligible: list[int]


class HandPlayerView(BaseModel):
    seat: int
    stack: int
    street_bet: int
    total: int
    folded: bool
    all_in: bool


class ClaimView(BaseModel):
    by: int
    winners: list[list[int]]
    confirmed: list[int]


class MyTurn(BaseModel):
    """What you may do now."""

    to_call: int
    can_check: bool
    # The smallest and biggest total you may bet or raise to. Empty: you can't raise.
    raise_min: int | None
    raise_max: int | None


class HandView(BaseModel):
    number: int
    # preflop, flop, turn, river, showdown or done.
    street: str
    # The last street bet on before the showdown, so the dealer knows which cards are out.
    reached: str
    button: int
    small_blind_seat: int
    big_blind_seat: int
    to_act: int | None
    turn_ends_at: datetime | None
    current_bet: int
    pots: list[PotView]
    # The pots the showdown has to decide (more than one player can win them).
    contested: list[PotView]
    players: list[HandPlayerView]
    log: list[dict]
    payouts: dict[int, int]
    claim: ClaimView | None
    my_turn: MyTurn | None
    # With a turn timer: the round's cards are being dealt. Nobody bets until they're out.
    waiting_for_cards: bool
    # The seat of whoever dealt, if they're still sitting here.
    dealer_seat: int | None
    # Whether you're the one who says the cards are out (the dealer, or anyone in the hand once
    # the dealer has gone).
    i_say_cards_out: bool


def view(row: PokerHand, table: PokerTable, user: User) -> HandView:
    hand = poker.Hand.from_data(row.state)
    my_number = next(
        (int(n) for n, seat_id in row.seat_ids.items() if _seat_user(table, seat_id) == user.id),
        None,
    )
    my_turn = None
    waiting = row.waiting_for_cards and hand.to_act is not None
    if hand.to_act is not None and hand.to_act == my_number and not waiting:
        allowed = poker.raise_range(hand, my_number)
        owed = poker.to_call(hand, my_number)
        my_turn = MyTurn(
            to_call=owed,
            can_check=owed == 0,
            raise_min=allowed[0] if allowed else None,
            raise_max=allowed[1] if allowed else None,
        )
    timer = table.turn_seconds
    return HandView(
        number=row.number,
        street=hand.street,
        reached=hand.reached,
        button=hand.button,
        small_blind_seat=hand.small_blind_seat,
        big_blind_seat=hand.big_blind_seat,
        to_act=hand.to_act,
        turn_ends_at=(
            row.turn_started_at + timedelta(seconds=timer)
            if timer is not None and hand.to_act is not None and not waiting
            else None
        ),
        current_bet=hand.current_bet,
        pots=[PotView(amount=p.amount, eligible=p.eligible) for p in poker.pots(hand)],
        contested=[PotView(amount=p.amount, eligible=p.eligible) for p in poker.contested(hand)]
        if hand.street == "showdown"
        else [],
        players=[
            HandPlayerView(
                seat=p.seat,
                stack=p.stack,
                street_bet=p.street_bet,
                total=p.total,
                folded=p.folded,
                all_in=p.all_in,
            )
            for p in hand.players
        ],
        log=hand.log,
        payouts=hand.payouts,
        claim=ClaimView(**row.claim) if row.claim else None,
        my_turn=my_turn,
        waiting_for_cards=waiting,
        dealer_seat=dealer_seat(table, row),
        i_say_cards_out=waiting and says_cards_out(table, row, user),
    )


def dealer_seat(table: PokerTable, row: PokerHand) -> int | None:
    return next(
        (s.number for s in table.seats if s.left_at is None and s.user_id == row.dealer_id), None
    )


def says_cards_out(table: PokerTable, row: PokerHand, user: User) -> bool:
    """The dealer says when the cards are out. If they got up, anyone in the hand can."""
    if dealer_seat(table, row) is not None:
        return user.id == row.dealer_id
    return any(
        s.user_id == user.id and s.left_at is None and row.seat_ids.get(str(s.number)) == s.id
        for s in table.seats
    )


def _seat_user(table: PokerTable, seat_id: int) -> int | None:
    return next((s.user_id for s in table.seats if s.id == seat_id), None)
