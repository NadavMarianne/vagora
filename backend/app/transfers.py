"""Sending coins to another member of the same market (issue #46).

Only when the market allows it (its "members can send coins" setting). The coins leave the
sender and reach the other member in one step, with an entry in each one's history, and can't be
taken back. Nobody can send more than they have.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints

from app import ledger, signals
from app.markets import active_memberships, get_membership
from app.models import EntryKind, Membership, User
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets", tags=["markets"])

# Entries' notes hold at most 100 characters (see LedgerEntry).
NOTE_ROOM = 100


class SendIn(BaseModel):
    to: str
    amount: Annotated[int, Field(ge=1, le=1_000_000_000)]
    # An optional short message, like "Happy birthday".
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""


class SendView(BaseModel):
    my_balance: int


def entry_note(start: str, note: str) -> str:
    """"To Noa" or "To Noa: Happy birthday", cut to fit."""
    text = f"{start}: {note}" if note else start
    return text if len(text) <= NOTE_ROOM else text[: NOTE_ROOM - 1] + "…"


@router.post("/{market_id}/send")
def send_coins(market_id: int, body: SendIn, user: CurrentUser, db: DbSession) -> SendView:
    """Sends coins to another member, if the market allows it."""
    sender = get_membership(db, user, market_id)
    market = sender.market
    if not market.transfers_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sending coins is off in this market.")
    receiver = db.scalar(
        active_memberships()
        .join(User, Membership.user_id == User.id)
        .where(Membership.market_id == market_id, User.username == body.to)
    )
    if receiver is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "They're not in this market.")
    if receiver.id == sender.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't send coins to yourself.")

    # Both balances change in member order, so two people sending to each other at the same
    # moment can't block each other. If the sender is short, nothing is saved.
    moves = [
        (sender, -body.amount, EntryKind.SENT, f"To {receiver.user.display_name}"),
        (receiver, body.amount, EntryKind.RECEIVED, f"From {user.display_name}"),
    ]
    try:
        for membership, amount, kind, start in sorted(moves, key=lambda move: move[0].id):
            ledger.record(db, membership, amount, kind, entry_note(start, body.note))
    except ledger.NotEnoughCoins:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You don't have that many coins.") from None
    db.commit()

    amount = f"{body.amount:,} {market.currency_name}"
    message = f"{user.display_name} sent you {amount}"
    signals.notify(
        db,
        [receiver.user.firebase_uid],
        f"market:{market_id}",
        f"{message}: {body.note}" if body.note else message,
        f"/markets/{market_id}",
        "good",
    )
    signals.notify(db, [user.firebase_uid], f"market:{market_id}")
    return SendView(my_balance=sender.balance)
