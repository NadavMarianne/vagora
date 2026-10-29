"""The only way coins move: a ledger entry plus the same change to the stored balance."""

from sqlalchemy import update
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value

from app.models import EntryKind, LedgerEntry, Membership


class NotEnoughCoins(Exception):
    """The balance doesn't cover this payment (no debt allowed)."""


def record(
    db: Session, membership: Membership, amount: int, kind: EntryKind, note: str
) -> LedgerEntry:
    """Adds a ledger entry and changes the stored balance by the same amount.

    Both happen in the caller's transaction, so either both are saved or neither is.
    The balance is changed in one database step that only succeeds if it stays at zero or
    above, so two payments at the same moment can't overdraw it.
    """
    new_balance = db.scalar(
        update(Membership)
        .where(Membership.id == membership.id, Membership.balance + amount >= 0)
        .values(balance=Membership.balance + amount)
        .returning(Membership.balance)
        .execution_options(synchronize_session=False)
    )
    if new_balance is None:
        raise NotEnoughCoins
    set_committed_value(membership, "balance", new_balance)

    entry = LedgerEntry(membership_id=membership.id, amount=amount, kind=kind, note=note)
    db.add(entry)
    db.flush()
    return entry
