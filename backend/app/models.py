"""Database tables."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    """A person's vagora profile. Firebase knows how they log in; this knows who they are here."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True)
    # Stored in lowercase, so "Nadav" and "nadav" are the same username.
    username: Mapped[str] = mapped_column(String(20), unique=True)
    display_name: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Market(Base):
    """A market and its settings. Its rules are data, not code."""

    __tablename__ = "markets"
    __table_args__ = (CheckConstraint("starting_amount >= 0", name="starting_amount_not_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    currency_name: Mapped[str] = mapped_column(String(20))
    starting_amount: Mapped[int] = mapped_column(BigInteger)
    transfers_enabled: Mapped[bool] = mapped_column(server_default="false")
    # A time zone name like "Asia/Jerusalem". Schedules use it.
    time_zone: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Set when the last member leaves. Deleted for good 30 days later unless someone rejoins.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list["Membership"]] = relationship(back_populates="market")


class Membership(Base):
    """A person in a market, with their balance there."""

    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("market_id", "user_id", name="one_membership_per_market"),
        # No debt: the database itself refuses a negative balance.
        CheckConstraint("balance >= 0", name="balance_not_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Always equal to the sum of this membership's ledger entries (see app/ledger.py).
    balance: Mapped[int] = mapped_column(BigInteger, server_default="0")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Who invited this person. Empty for the person who created the market.
    invited_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    # Set when they leave. Their balance stays frozen here until they come back.
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    market: Mapped[Market] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(foreign_keys=[user_id])
    invited_by: Mapped[User | None] = relationship(foreign_keys=[invited_by_id])


class InviteStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class Invite(Base):
    """An invitation for someone to join a market. They accept or decline it."""

    __tablename__ = "invites"
    __table_args__ = (
        # At most one pending invite per person per market.
        Index(
            "one_pending_invite_per_person",
            "market_id",
            "invited_user_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"))
    invited_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    invited_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), server_default=InviteStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    market: Mapped[Market] = relationship()
    invited_user: Mapped[User] = relationship(foreign_keys=[invited_user_id])
    invited_by: Mapped[User] = relationship(foreign_keys=[invited_by_id])


class EntryKind(StrEnum):
    """Why coins moved."""

    STARTING_AMOUNT = "starting_amount"


class LedgerEntry(Base):
    """One movement of coins. Entries are only ever added, never changed."""

    __tablename__ = "ledger_entries"
    __table_args__ = (CheckConstraint("amount <> 0", name="amount_not_zero"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(ForeignKey("memberships.id"), index=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    kind: Mapped[str] = mapped_column(String(30))
    note: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
