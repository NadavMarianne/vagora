import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app import ledger
from app.models import EntryKind, LedgerEntry, Market, Membership, User


@pytest.fixture
def membership(db):
    user = User(firebase_uid="uid-dana", username="dana_k", display_name="Dana")
    market = Market(
        name="Home", currency_name="hearts", starting_amount=0, time_zone="Asia/Jerusalem"
    )
    membership = Membership(user=user, market=market)
    db.add_all([user, market, membership])
    db.flush()
    return membership


def ledger_total(db, membership):
    """The audit: adds up every entry, which must always equal the stored balance."""
    return db.scalar(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            LedgerEntry.membership_id == membership.id
        )
    )


def test_entries_change_the_balance(db, membership):
    ledger.record(db, membership, 1000, EntryKind.STARTING_AMOUNT, "Starting amount")
    ledger.record(db, membership, -300, EntryKind.STARTING_AMOUNT, "Spent")

    assert membership.balance == 700
    assert ledger_total(db, membership) == 700


def test_spending_everything_is_allowed(db, membership):
    ledger.record(db, membership, 500, EntryKind.STARTING_AMOUNT, "In")
    ledger.record(db, membership, -500, EntryKind.STARTING_AMOUNT, "Out")

    assert membership.balance == 0


def test_no_debt(db, membership):
    ledger.record(db, membership, 100, EntryKind.STARTING_AMOUNT, "In")

    with pytest.raises(ledger.NotEnoughCoins):
        ledger.record(db, membership, -150, EntryKind.STARTING_AMOUNT, "Too much")

    db.refresh(membership)
    assert membership.balance == 100
    assert ledger_total(db, membership) == 100


def test_database_itself_refuses_a_negative_balance(db, membership):
    # Even code that skips app/ledger.py can't create debt.
    with pytest.raises(IntegrityError):
        db.execute(update(Membership).where(Membership.id == membership.id).values(balance=-1))
