"""Store endpoints for buying and orders (decision 0021, sections 4 to 6).

Buying holds the price. The buyer marks the order fulfilled, or the seller says "I did it" and
it completes after 3 days unless the buyer disputes. Refundable orders can be cancelled before
their deadline. Non-refundable ones can be discarded, or the buyer can ask the seller for a refund.
"""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import ledger, order_flow, signals, store
from app.markets import get_membership
from app.models import EntryKind, Offer, Order, OrderStatus, Product, User
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets/{market_id}", tags=["store"])


class OrderView(BaseModel):
    id: int
    product_id: int
    product_name: str
    # Whether you bought it or are selling it.
    role: Literal["buyer", "seller"]
    other_display_name: str
    price: int
    coin_mode: str
    delivery: str
    refundable: bool
    refund_percent: int
    status: str
    created_at: datetime
    due_at: datetime
    # A fixed deadline that passed while the order was still open.
    late: bool
    done_claimed_at: datetime | None
    auto_complete_at: datetime | None
    refund_requested: bool
    ended_at: datetime | None


def order_view(order: Order, user: User) -> OrderView:
    is_buyer = order.buyer_id == user.id
    return OrderView(
        id=order.id,
        product_id=order.offer.product_id,
        product_name=order.product_name,
        role="buyer" if is_buyer else "seller",
        other_display_name=(order.seller if is_buyer else order.buyer).display_name,
        price=order.price,
        coin_mode=order.coin_mode,
        delivery=order.delivery,
        refundable=order.refundable,
        refund_percent=order.refund_percent,
        status=order.status,
        created_at=order.created_at,
        due_at=order.due_at,
        late=order.status == OrderStatus.OPEN
        and order.delivery == "deadline"
        and order.due_at <= store.now(),
        done_claimed_at=order.done_claimed_at,
        auto_complete_at=order_flow.auto_complete_at(order),
        refund_requested=order.refund_requested,
        ended_at=order.ended_at,
    )


def conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def tell(order: Order, to: User, message: str) -> None:
    """Refreshes both sides' screens, with a banner for `to`."""
    other = order.buyer if to.id == order.seller_id else order.seller
    reason = f"market:{order.market_id}"
    signals.notify([other.firebase_uid], reason)
    signals.notify([to.firebase_uid], reason, message)


@router.post("/offers/{offer_id}/buy", status_code=status.HTTP_201_CREATED)
def buy(market_id: int, offer_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """Buys an offer. The price leaves your balance at once and is held until the order ends."""
    membership = get_membership(db, user, market_id)
    offer = db.scalar(
        store.active_offers()
        .join(Product)
        .where(Offer.id == offer_id, Product.market_id == market_id)
        .with_for_update(of=Offer)
    )
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This offer isn't available any more.")
    if offer.seller_id == user.id:
        raise conflict("You can't buy your own offer.")
    if offer.stock is not None and offer.stock <= 0:
        raise conflict("This offer is sold out.")

    product = offer.product
    note = f"Bought {product.name} from {offer.seller.display_name}"
    try:
        ledger.record(db, membership, -offer.price, EntryKind.PURCHASE, note[:100])
    except ledger.NotEnoughCoins as error:
        db.rollback()
        raise conflict("You don't have enough coins.") from error
    if offer.stock is not None:
        offer.stock -= 1
    if offer.committed_stock is not None and offer.committed_stock > 0:
        offer.committed_stock -= 1

    now = store.now()
    order = Order(
        market_id=market_id,
        offer=offer,
        buyer=user,
        seller=offer.seller,
        product_name=product.name,
        coin_mode=product.coin_mode,
        price=offer.price,
        delivery=offer.delivery,
        refundable=offer.refundable,
        refund_percent=offer.refund_percent,
        created_at=now,
        due_at=now + timedelta(seconds=offer.duration_seconds),
    )
    db.add(order)
    db.commit()
    signals.notify_market(db, market_id)
    tell(order, offer.seller, f"{user.display_name} bought {product.name}")
    return order_view(order, user)


@router.get("/orders")
def list_orders(market_id: int, user: CurrentUser, db: DbSession) -> list[OrderView]:
    """Your orders in this market, as a buyer and as a seller, newest first."""
    get_membership(db, user, market_id)
    orders = db.scalars(
        select(Order)
        .where(
            Order.market_id == market_id,
            or_(Order.buyer_id == user.id, Order.seller_id == user.id),
        )
        .order_by(Order.id.desc())
        .limit(100)
    )
    return [order_view(o, user) for o in orders]


def get_order(db: Session, user: User, market_id: int, order_id: int) -> Order:
    """One of your orders, locked so two actions on it can't happen at once."""
    get_membership(db, user, market_id)
    order = db.scalar(
        select(Order)
        .where(
            Order.id == order_id,
            Order.market_id == market_id,
            or_(Order.buyer_id == user.id, Order.seller_id == user.id),
        )
        .with_for_update()
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return order


def as_buyer(order: Order, user: User, *allowed: OrderStatus) -> None:
    if order.buyer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the buyer can do this.")
    if order.status not in allowed:
        raise conflict("This order can't do that now.")


def as_seller(order: Order, user: User, *allowed: OrderStatus) -> None:
    if order.seller_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the seller can do this.")
    if order.status not in allowed:
        raise conflict("This order can't do that now.")


@router.get("/orders/{order_id}")
def get_order_details(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    return order_view(get_order(db, user, market_id, order_id), user)


@router.post("/orders/{order_id}/fulfilled")
def mark_fulfilled(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The buyer confirms it was done. In a dispute, this is the buyer giving up (a settlement)."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, *order_flow.ACTIVE)
    order_flow.end(db, order, OrderStatus.COMPLETED, 0)
    db.commit()
    tell(order, order.seller, f"{user.display_name} marked {order.product_name} as done")
    return order_view(order, user)


@router.post("/orders/{order_id}/done")
def claim_done(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The seller says "I did it". It completes in 3 days unless the buyer disputes."""
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, OrderStatus.OPEN)
    order.status = OrderStatus.DONE_CLAIMED
    order.done_claimed_at = store.now()
    order.refund_requested = False
    db.commit()
    tell(order, order.buyer, f"{user.display_name} says {order.product_name} is done")
    return order_view(order, user)


@router.post("/orders/{order_id}/dispute")
def dispute(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The buyer says it wasn't done. The coins stay held until it's settled (decision 0023)."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.DONE_CLAIMED)
    order.status = OrderStatus.DISPUTED
    db.commit()
    tell(order, order.seller, f"{user.display_name} disputes {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/cancel")
def cancel(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """Cancels a refundable order before its deadline. The refund percentage comes back."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.OPEN)
    if not order.refundable:
        raise conflict("This order isn't refundable. You can discard it or ask for a refund.")
    if order.due_at <= store.now():
        raise conflict("The time to cancel has passed.")
    order_flow.end(
        db, order, OrderStatus.CANCELLED, order_flow.share(order.price, order.refund_percent)
    )
    db.commit()
    tell(order, order.seller, f"{user.display_name} cancelled {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/discard")
def discard(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """Gives up a non-refundable order. No coins come back."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.OPEN)
    if order.refundable:
        raise conflict("This order is refundable, so cancel it instead.")
    order_flow.end(db, order, OrderStatus.DISCARDED, 0)
    db.commit()
    tell(order, order.seller, f"{user.display_name} gave up {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/request-refund")
def request_refund(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """Asks the seller to refund a non-refundable order."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.OPEN)
    if order.refundable:
        raise conflict("This order is refundable, so cancel it instead.")
    order.refund_requested = True
    db.commit()
    tell(order, order.seller, f"{user.display_name} asks for a refund for {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/refund")
def refund(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The seller gives the full price back: accepting a refund request, or giving up a dispute
    (a settlement)."""
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, *order_flow.ACTIVE)
    order_flow.end(db, order, OrderStatus.CANCELLED, order.price)
    db.commit()
    tell(order, order.buyer, f"{user.display_name} refunded {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/decline-refund")
def decline_refund(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, OrderStatus.OPEN)
    if not order.refund_requested:
        raise conflict("No refund was asked for.")
    order.refund_requested = False
    db.commit()
    tell(order, order.buyer, f"{user.display_name} declined a refund for {order.product_name}")
    return order_view(order, user)
