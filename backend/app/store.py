"""The store's shared rules (decision 0021): offer terms, commitments, and catching up.

Nothing runs on a timer. Whenever a market's store is used, `catch_up` expires proposals nobody
answered and removes offers whose time is up, so the store is always right when anyone looks.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal, Self

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Offer, Product, Proposal, ProposalStatus

# Whole coins, at least 1. The upper limit keeps totals far from the database's number limits.
Price = Annotated[int, Field(ge=1, le=1_000_000_000)]
# How long a deadline or validity lasts: 10 seconds to a year.
Duration = Annotated[int, Field(ge=10, le=365 * 24 * 3600)]
StockCount = Annotated[int, Field(ge=1, le=1_000_000)]


def now() -> datetime:
    return datetime.now(UTC)


class CommitmentIn(BaseModel):
    """A promise to keep the offer, by time, by purchases, or both."""

    until: datetime | None = None
    stock: StockCount | None = None
    # With both: released when the first runs out, or only when both have.
    release: Literal["first", "all"] = "first"

    @model_validator(mode="after")
    def has_something(self) -> Self:
        if self.until is None and self.stock is None:
            raise ValueError("A commitment needs a date, a number of purchases, or both.")
        return self


class OfferTerms(BaseModel):
    """The seller's terms, set when accepting a proposal and changed later if not committed."""

    delivery: Literal["deadline", "on_request"]
    duration_seconds: Duration
    refundable: bool
    refund_percent: Annotated[int, Field(ge=1, le=100)] = 100
    stock: StockCount | None = None
    commitment: CommitmentIn | None = None
    remove_at: datetime | None = None


class OfferView(BaseModel):
    id: int
    seller_username: str
    seller_display_name: str
    is_mine: bool
    price: int
    delivery: str
    duration_seconds: int
    refundable: bool
    refund_percent: int
    stock: int | None
    committed: bool
    committed_price: int | None
    committed_until: datetime | None
    committed_stock: int | None
    commitment_release: str | None
    remove_at: datetime | None


def unprocessable(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, message)


def check_terms(terms: OfferTerms) -> None:
    """Checks the parts of the terms that depend on the current time or on each other."""
    commitment = terms.commitment
    if commitment is not None:
        if commitment.until is not None and commitment.until <= now():
            raise unprocessable("The commitment's date must be in the future.")
        if commitment.stock is not None and terms.stock is not None:
            if commitment.stock > terms.stock:
                raise unprocessable("You can't commit to more purchases than the stock.")
    if terms.remove_at is not None:
        if terms.remove_at <= now():
            raise unprocessable("The removal date must be in the future.")
        if commitment is not None and commitment.until is not None:
            if terms.remove_at < commitment.until:
                raise unprocessable("The removal date can't be before the commitment ends.")


def apply_terms(offer: Offer, terms: OfferTerms) -> None:
    """Sets an offer's terms. A commitment locks the offer's current price as its highest."""
    check_terms(terms)
    offer.delivery = terms.delivery
    offer.duration_seconds = terms.duration_seconds
    offer.refundable = terms.refundable
    offer.refund_percent = terms.refund_percent if terms.refundable else 100
    offer.stock = terms.stock
    offer.remove_at = terms.remove_at
    commitment = terms.commitment
    has_both = commitment is not None and commitment.until and commitment.stock
    offer.committed_price = offer.price if commitment else None
    offer.committed_until = commitment.until if commitment else None
    offer.committed_stock = commitment.stock if commitment else None
    offer.commitment_release = commitment.release if has_both else None


def is_committed(offer: Offer, at: datetime | None = None) -> bool:
    """Whether the offer's commitment still holds."""
    if offer.committed_price is None:
        return False
    at = at or now()
    has_time = offer.committed_until is not None
    has_stock = offer.committed_stock is not None
    time_out = has_time and offer.committed_until <= at
    stock_out = has_stock and offer.committed_stock <= 0
    if has_time and has_stock and offer.commitment_release == "all":
        return not (time_out and stock_out)
    return not (time_out or stock_out)


def offer_view(offer: Offer, viewer_id: int) -> OfferView:
    return OfferView(
        id=offer.id,
        seller_username=offer.seller.username,
        seller_display_name=offer.seller.display_name,
        is_mine=offer.seller_id == viewer_id,
        price=offer.price,
        delivery=offer.delivery,
        duration_seconds=offer.duration_seconds,
        refundable=offer.refundable,
        refund_percent=offer.refund_percent,
        stock=offer.stock,
        committed=is_committed(offer),
        committed_price=offer.committed_price,
        committed_until=offer.committed_until,
        committed_stock=offer.committed_stock,
        commitment_release=offer.commitment_release,
        remove_at=offer.remove_at,
    )


def active_offers():
    """Offers that haven't been removed."""
    return select(Offer).where(Offer.removed_at.is_(None))


def pending_proposals():
    return select(Proposal).where(Proposal.status == ProposalStatus.PENDING)


def should_end(offer: Offer, at: datetime) -> bool:
    """An offer ends when its removal date or its product's closing comes, once not committed."""
    if is_committed(offer, at):
        return False
    due = offer.remove_at is not None and offer.remove_at <= at
    return due or offer.product.closed_at is not None


def catch_up(db: Session, market_id: int) -> bool:
    """Expires unanswered proposals and removes offers whose time is up. The caller commits.

    Returns whether anything changed.
    """
    at = now()
    changed = False
    expired = db.scalars(
        pending_proposals()
        .join(Product)
        .where(Product.market_id == market_id, Proposal.expires_at <= at)
    )
    for proposal in expired:
        proposal.status = ProposalStatus.EXPIRED
        changed = True
    offers = db.scalars(active_offers().join(Product).where(Product.market_id == market_id))
    for offer in offers:
        if should_end(offer, at):
            offer.removed_at = at
            changed = True
    return changed


def end_offers_and_proposals(offers: list[Offer], proposals: list[Proposal]) -> None:
    """Removes these offers (those not committed) and cancels these proposals."""
    at = now()
    for offer in offers:
        if not is_committed(offer, at):
            offer.removed_at = at
    for proposal in proposals:
        proposal.status = ProposalStatus.CANCELLED


def leave_store(db: Session, market_id: int, user_id: int) -> None:
    """Called when someone leaves a market. The caller commits.

    Refuses if they have committed offers (decision 0021, section 8). Otherwise their offers are
    removed and proposals waiting for them are declined.
    """
    offers = db.scalars(
        active_offers()
        .join(Product)
        .where(Product.market_id == market_id, Offer.seller_id == user_id)
    ).all()
    if any(is_committed(offer) for offer in offers):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You can't leave while you have committed offers."
        )
    at = now()
    for offer in offers:
        offer.removed_at = at
    proposals = db.scalars(
        pending_proposals()
        .join(Product)
        .where(Product.market_id == market_id, Proposal.seller_id == user_id)
    )
    for proposal in proposals:
        proposal.status = ProposalStatus.DECLINED


def expires_in(seconds: int) -> datetime:
    return now() + timedelta(seconds=seconds)
