"""Store endpoints for changing and removing your offers (decision 0021, section 3).

Without a commitment, a seller can change anything or remove the offer. While committed, they
can only lower the price (and raise it back, up to the committed price) and extend the commitment.
"""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import signals, store
from app.models import Offer, Product, User
from app.products import ProductView, open_store, product_view
from app.store import OfferTerms, Price, StockCount
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets/{market_id}/offers", tags=["store"])


class OfferChange(BaseModel):
    """What to change. Leave out anything that stays the same.

    `terms` replaces all the terms, and only works without a commitment. While committed, send
    `committed_until` or `committed_stock` to extend the commitment.
    """

    price: Price | None = None
    terms: OfferTerms | None = None
    committed_until: datetime | None = None
    committed_stock: StockCount | None = None


def conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def get_my_offer(db: Session, user: User, market_id: int, offer_id: int) -> Offer:
    offer = db.scalar(
        store.active_offers()
        .join(Product)
        .where(Offer.id == offer_id, Product.market_id == market_id, Offer.seller_id == user.id)
        .with_for_update(of=Offer)
    )
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Offer not found.")
    return offer


def change_committed(offer: Offer, change: OfferChange) -> None:
    if change.terms is not None:
        raise conflict("This offer is committed. You can only change its price or extend it.")
    if change.price is not None and change.price > offer.committed_price:
        raise conflict(f"While committed, the price can't go above {offer.committed_price}.")
    if change.committed_until is not None:
        if offer.committed_until is None or change.committed_until < offer.committed_until:
            raise conflict("A commitment can be extended, never shortened.")
        offer.committed_until = change.committed_until
    if change.committed_stock is not None:
        if offer.committed_stock is None or change.committed_stock < offer.committed_stock:
            raise conflict("A commitment can be extended, never shortened.")
        if offer.stock is not None and change.committed_stock > offer.stock:
            raise conflict("You can't commit to more purchases than the stock.")
        offer.committed_stock = change.committed_stock
    if change.price is not None:
        offer.price = change.price


def change_free(offer: Offer, change: OfferChange) -> None:
    if change.committed_until is not None or change.committed_stock is not None:
        raise conflict("This offer has no commitment to extend. Add one in its terms.")
    if change.price is not None:
        offer.price = change.price
    if change.terms is not None:
        # After the price, so a new commitment locks the new price.
        store.apply_terms(offer, change.terms)


@router.patch("/{offer_id}")
def change_offer(
    market_id: int, offer_id: int, change: OfferChange, user: CurrentUser, db: DbSession
) -> ProductView:
    open_store(db, user, market_id)
    offer = get_my_offer(db, user, market_id, offer_id)
    if store.is_committed(offer):
        change_committed(offer, change)
    else:
        change_free(offer, change)
    db.commit()
    signals.notify_market(db, market_id)
    return product_view(offer.product, user)


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_offer(market_id: int, offer_id: int, user: CurrentUser, db: DbSession) -> None:
    """Stops selling. Not possible while the offer is committed."""
    open_store(db, user, market_id)
    offer = get_my_offer(db, user, market_id, offer_id)
    if store.is_committed(offer):
        raise conflict("This offer is committed, so it can't be removed yet.")
    offer.removed_at = store.now()
    db.commit()
    signals.notify_market(db, market_id)
