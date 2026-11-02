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
from sqlalchemy.dialects.postgresql import JSONB
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
    allowances: Mapped[list["Allowance"]] = relationship(
        back_populates="market", cascade="all, delete-orphan", order_by="Allowance.id"
    )


class Allowance(Base):
    """Coins every member gets on a schedule. A market can have any number of them."""

    __tablename__ = "allowances"
    __table_args__ = (CheckConstraint("amount > 0", name="allowance_amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), index=True)
    # Shown on each payout, like "Pocket money". Doesn't have to be unique.
    name: Mapped[str] = mapped_column(String(50))
    amount: Mapped[int] = mapped_column(BigInteger)
    enabled: Mapped[bool] = mapped_column(server_default="true")
    # When it's paid, as described by AllowanceSchedule in app/allowance.py. Stored as JSON.
    schedule: Mapped[dict] = mapped_column(JSONB)
    # Payouts count from this moment. Reset when the allowance is created, switched on, or its
    # timing changes, so nothing from before then is paid.
    counting_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    market: Mapped[Market] = relationship(back_populates="allowances")


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
    # Allowances are paid up to this moment. Time away from the market is never paid.
    allowance_paid_until: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

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
    ALLOWANCE = "allowance"


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


class CoinMode(StrEnum):
    """Where the coins of a completed order go. Each product's creator picks one."""

    TO_SELLER = "to_seller"
    VANISH = "vanish"


class Product(Base):
    """Something that can be bought in a market's store. Members sell it through offers."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(String(500), server_default="")
    coin_mode: Mapped[str] = mapped_column(String(20))
    # How long a seller has to answer a proposal for this product.
    proposal_expiry_seconds: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Set when the creator closes it: no new proposals, and offers without a commitment end.
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    creator: Mapped[User] = relationship()
    proposals: Mapped[list["Proposal"]] = relationship(
        back_populates="product", order_by="Proposal.id"
    )
    offers: Mapped[list["Offer"]] = relationship(back_populates="product", order_by="Offer.id")


class ProposalStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class Proposal(Base):
    """An invitation to sell a product at a price. The seller accepts or declines."""

    __tablename__ = "proposals"
    __table_args__ = (
        CheckConstraint("price > 0", name="proposal_price_positive"),
        # At most one pending proposal per seller per product.
        Index(
            "one_pending_proposal_per_seller",
            "product_id",
            "seller_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    price: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(20), server_default=ProposalStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    product: Mapped[Product] = relationship(back_populates="proposals")
    seller: Mapped[User] = relationship()


class Offer(Base):
    """One seller's offer of a product: the price and the seller's terms."""

    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("price > 0", name="offer_price_positive"),
        CheckConstraint("stock IS NULL OR stock >= 0", name="offer_stock_not_negative"),
        # At most one offer per seller per product that hasn't been removed.
        Index(
            "one_offer_per_seller",
            "product_id",
            "seller_id",
            unique=True,
            postgresql_where=text("removed_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    price: Mapped[int] = mapped_column(BigInteger)
    # "deadline": done within `duration_seconds` of buying. "on_request": the buyer asks for it
    # in person, any time within `duration_seconds` of buying.
    delivery: Mapped[str] = mapped_column(String(20))
    duration_seconds: Mapped[int] = mapped_column(BigInteger)
    refundable: Mapped[bool] = mapped_column()
    # How much of the price a refund gives back, 1 to 100.
    refund_percent: Mapped[int] = mapped_column(server_default="100")
    # How many more times it can be bought. Empty means no limit.
    stock: Mapped[int | None] = mapped_column()
    # The commitment, if any (see app/offers.py): the price can't go above `committed_price`
    # until it's released, by time (`committed_until`), by purchases (`committed_stock` left),
    # or both, released when the first runs out ("first") or when both do ("all").
    committed_price: Mapped[int | None] = mapped_column(BigInteger)
    committed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    committed_stock: Mapped[int | None] = mapped_column()
    commitment_release: Mapped[str | None] = mapped_column(String(10))
    # Removed on its own from this moment, once any commitment is released.
    remove_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    product: Mapped[Product] = relationship(back_populates="offers")
    seller: Mapped[User] = relationship()
