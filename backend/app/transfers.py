"""Sending coins to another member of the same market (issue #46).

Only when the market allows it (its "members can send coins" setting). The coins leave the
sender and reach the other member in one step, with an entry in each one's history, and can't be
taken back. Nobody can send more than they have.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import select

from app import ledger, signals
from app.markets import active_memberships, get_membership
from app.models import EntryKind, LedgerEntry, Membership, User
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


class SentView(BaseModel):
    amount: int
    # The note the coins were sent with, if any (or the whole entry, if their name changed).
    note: str
    created_at: datetime


# How many of your last sends to someone their page shows.
RECENT = 2


def entry_note(start: str, note: str) -> str:
    """The entry's note, like "To Noa" or "To Noa: Happy birthday", cut to fit."""
    text = f"{start}: {note}" if note else start
    return text if len(text) <= NOTE_ROOM else text[: NOTE_ROOM - 1] + "…"


@router.post("/{market_id}/send")
def send_coins(market_id: int, body: SendIn, user: CurrentUser, db: DbSession) -> SendView:
    """Sends coins to another member, if the market allows it."""
    sender = get_membership(db, user, market_id)
    market = sender.market
    if not market.transfers_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sending coins is off in this market.")
    receiver = member_in(db, market_id, body.to)
    if receiver.id == sender.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't send coins to yourself.")

    # Both balances change in member order, so two people sending to each other at the same
    # moment can't block each other. If the sender is short, nothing is saved.
    moves = [
        (sender, -body.amount, EntryKind.SENT, f"To {receiver.user.display_name}", receiver),
        (receiver, body.amount, EntryKind.RECEIVED, f"From {user.display_name}", sender),
    ]
    try:
        for membership, amount, kind, start, other in sorted(moves, key=lambda m: m[0].id):
            note = entry_note(start, body.note)
            ledger.record(db, membership, amount, kind, note, other=other)
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


def member_in(db, market_id: int, username: str) -> Membership:
    """Someone currently in this market, by username."""
    membership = db.scalar(
        active_memberships()
        .join(User, Membership.user_id == User.id)
        .where(Membership.market_id == market_id, User.username == username)
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "They're not in this market.")
    return membership


@router.get("/{market_id}/sent/{username}")
def recent_sends(market_id: int, username: str, user: CurrentUser, db: DbSession) -> list[SentView]:
    """Your last few sends to this member, newest first."""
    me = get_membership(db, user, market_id)
    them = member_in(db, market_id, username)
    entries = db.scalars(
        select(LedgerEntry)
        .where(
            LedgerEntry.membership_id == me.id,
            LedgerEntry.kind == EntryKind.SENT,
            LedgerEntry.other_membership_id == them.id,
        )
        .order_by(LedgerEntry.created_at.desc(), LedgerEntry.id.desc())
        .limit(RECENT)
    )
    # The entry says "To Noa: Happy birthday" (or just "To Noa"); the page shows only the note.
    prefix = f"To {them.user.display_name}"

    def note_of(entry: LedgerEntry) -> str:
        if entry.note == prefix:
            return ""
        return entry.note.removeprefix(f"{prefix}: ")

    return [
        SentView(amount=-e.amount, note=note_of(e), created_at=e.created_at) for e in entries
    ]
