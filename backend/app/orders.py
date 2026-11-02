"""Store endpoints for buying and orders (decision 0021, sections 4 to 6).

Buying holds the price. The buyer marks the order fulfilled, or the seller says "I did it" and
it completes after 3 days unless the buyer disputes. Refundable orders can be cancelled before
their deadline. Non-refundable ones can be discarded, or the buyer can ask the seller for a refund.

After a missed deadline, the buyer chooses with no time limit: cancel (a full refund, which the
seller can contest for a while) or propose a new deadline. Doing nothing is waiting for it late.
Meanwhile the seller can end the order, which counts as refusing.
"""

from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import ledger, order_flow, signals, store
from app.markets import get_membership
from app.models import EntryKind, Market, Offer, Order, OrderStatus, Product, User
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets/{market_id}", tags=["store"])

# Ten seconds to 30 days, like every other time people pick.
Seconds = Annotated[int, Field(ge=10, le=30 * 24 * 3600)]


class NewDeadline(BaseModel):
    # How long the seller gets, counted from when they agree.
    deadline_seconds: Annotated[int, Field(ge=10, le=365 * 24 * 3600)]
    # How long the seller has to answer.
    expires_in_seconds: Seconds = 3 * 24 * 3600


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
    # The last missed deadline, and how many were missed.
    missed_at: datetime | None
    missed_count: int
    # A proposed new deadline: how long, when it was asked, and until when the seller can answer.
    new_deadline_seconds: int | None
    new_deadline_asked_at: datetime | None
    new_deadline_answer_by: datetime | None
    # A cancellation after a missed deadline: when it was made, and when it goes through
    # unless contested.
    contest_from: datetime | None
    contest_until: datetime | None
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
        missed_at=order.missed_at,
        missed_count=order.missed_count,
        new_deadline_seconds=order.new_deadline_seconds,
        new_deadline_asked_at=order.new_deadline_asked_at,
        new_deadline_answer_by=order.new_deadline_answer_by,
        contest_from=order.contest_from,
        contest_until=order.contest_until,
        done_claimed_at=order.done_claimed_at,
        auto_complete_at=order_flow.auto_complete_at(order),
        refund_requested=order.refund_requested,
        ended_at=order.ended_at,
    )


def conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def tell(db: Session, order: Order, to: User, message: str) -> None:
    """Refreshes both sides' screens, with a banner for `to` that opens the order."""
    other = order.buyer if to.id == order.seller_id else order.seller
    reason = f"market:{order.market_id}"
    signals.notify(db, [other.firebase_uid], reason)
    signals.notify(db, [to.firebase_uid], reason, message, order_path(order))


def order_path(order: Order) -> str:
    return f"/markets/{order.market_id}/orders/{order.id}"


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
    tell(db, order, offer.seller, f"{user.display_name} bought {product.name}")
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
    tell(db, order, order.seller, f"{user.display_name} marked {order.product_name} as done")
    return order_view(order, user)


@router.post("/orders/{order_id}/done")
def claim_done(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The seller says "I did it". It completes in 3 days unless the buyer disputes. Late work
    counts too. Against a cancellation after a missed deadline, it contests the refund, and the
    order becomes a dispute."""
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, OrderStatus.OPEN, *order_flow.MISSED, OrderStatus.CANCEL_PENDING)
    if order.status == OrderStatus.CANCEL_PENDING:
        order.status = OrderStatus.DISPUTED
        order.contest_until = None
        message = f"{user.display_name} says {order.product_name} was done, and disputes the refund"
    else:
        order.status = OrderStatus.DONE_CLAIMED
        order.done_claimed_at = store.now()
        message = f"{user.display_name} says {order.product_name} is done"
    order.refund_requested = False
    order.new_deadline_seconds = None
    order.new_deadline_asked_at = None
    order.new_deadline_answer_by = None
    db.commit()
    tell(db, order, order.buyer, message)
    return order_view(order, user)


@router.post("/orders/{order_id}/dispute")
def dispute(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The buyer says it wasn't done. The coins stay held until it's settled (decision 0023)."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.DONE_CLAIMED)
    order.status = OrderStatus.DISPUTED
    db.commit()
    tell(db, order, order.seller, f"{user.display_name} disputes {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/cancel")
def cancel(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """Cancels an order.

    Before the deadline, a refundable order gives back its refund percentage at once. After a
    missed deadline, any order can be cancelled for a full refund, but the seller gets the
    market's contest window first: if they say it was done, it becomes a dispute.
    """
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.OPEN, *order_flow.MISSED)
    if order.status in order_flow.MISSED:
        market = db.get(Market, market_id)
        order.status = OrderStatus.CANCEL_PENDING
        order.contest_from = store.now()
        order.contest_until = order.contest_from + timedelta(seconds=market.contest_window_seconds)
        order.new_deadline_seconds = None
        order.new_deadline_asked_at = None
        order.new_deadline_answer_by = None
        db.commit()
        tell(
            db,
            order,
            order.seller,
            f"{user.display_name} cancels {order.product_name}. Contest it if it was done.",
        )
        return order_view(order, user)
    if not order.refundable:
        raise conflict("This order isn't refundable. You can discard it or ask for a refund.")
    if order.due_at <= store.now():
        raise conflict("The time to cancel has passed.")
    order_flow.end(
        db, order, OrderStatus.CANCELLED, order_flow.share(order.price, order.refund_percent)
    )
    db.commit()
    tell(db, order, order.seller, f"{user.display_name} cancelled {order.product_name}")
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
    tell(db, order, order.seller, f"{user.display_name} gave up {order.product_name}")
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
    tell(db, order, order.seller, f"{user.display_name} asks for a refund for {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/refund")
def refund(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The seller gives the full price back: accepting a refund request, giving up a dispute
    (a settlement), or accepting a cancellation after a missed deadline instead of contesting."""
    order = get_order(db, user, market_id, order_id)
    as_seller(
        order,
        user,
        OrderStatus.OPEN,
        OrderStatus.DONE_CLAIMED,
        OrderStatus.DISPUTED,
        OrderStatus.CANCEL_PENDING,
    )
    ended_as = (
        OrderStatus.NOT_DELIVERED
        if order.status == OrderStatus.CANCEL_PENDING
        else OrderStatus.CANCELLED
    )
    order_flow.end(db, order, ended_as, order.price)
    db.commit()
    tell(db, order, order.buyer, f"{user.display_name} refunded {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/decline-refund")
def decline_refund(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, OrderStatus.OPEN)
    if not order.refund_requested:
        raise conflict("No refund was asked for.")
    order.refund_requested = False
    db.commit()
    tell(db, order, order.buyer, f"{user.display_name} declined a refund for {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/refused")
def refused(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """For "on request" orders: the buyer asked, and the seller refused. A missed deadline."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.OPEN)
    if order.delivery != "on_request":
        raise conflict("Only “on request” orders can be refused. Others miss their deadline.")
    order_flow.miss(order, at=store.now())
    db.commit()
    tell(db, order, order.seller, f"{user.display_name} says you refused {order.product_name}")
    return order_view(order, user)


@router.post("/orders/{order_id}/new-deadline")
def propose_deadline(
    market_id: int, order_id: int, new: NewDeadline, user: CurrentUser, db: DbSession
) -> OrderView:
    """The buyer proposes a new deadline. If the seller agrees, the new timer starts then."""
    order = get_order(db, user, market_id, order_id)
    as_buyer(order, user, OrderStatus.MISSED)
    order.status = OrderStatus.NEW_DEADLINE_ASKED
    order.new_deadline_seconds = new.deadline_seconds
    order.new_deadline_asked_at = store.now()
    order.new_deadline_answer_by = order.new_deadline_asked_at + timedelta(
        seconds=new.expires_in_seconds
    )
    db.commit()
    tell(
        db,
        order,
        order.seller,
        f"{user.display_name} proposes a new deadline for {order.product_name}",
    )
    return order_view(order, user)


@router.post("/orders/{order_id}/agree-deadline")
def agree_deadline(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The seller agrees: the order is open again, with a fixed deadline from now."""
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, OrderStatus.NEW_DEADLINE_ASKED)
    order.status = OrderStatus.OPEN
    # A new deadline is a fixed one, even for an "on request" order the seller refused.
    order.delivery = "deadline"
    order.due_at = store.now() + timedelta(seconds=order.new_deadline_seconds)
    order.new_deadline_seconds = None
    order.new_deadline_asked_at = None
    order.new_deadline_answer_by = None
    db.commit()
    tell(
        db,
        order,
        order.buyer,
        f"{user.display_name} agreed to a new deadline for {order.product_name}",
    )
    return order_view(order, user)


@router.post("/orders/{order_id}/decline-deadline")
def decline_deadline(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """The seller declines: the buyer chooses again (another deadline, waiting, or cancelling)."""
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, OrderStatus.NEW_DEADLINE_ASKED)
    order_flow.back_to_choosing(order)
    db.commit()
    tell(
        db,
        order,
        order.buyer,
        f"{user.display_name} declined a new deadline for {order.product_name}",
    )
    return order_view(order, user)


@router.post("/orders/{order_id}/end")
def end_order(market_id: int, order_id: int, user: CurrentUser, db: DbSession) -> OrderView:
    """After a missed deadline, the seller ends the order: a full refund. It counts as refusing,
    so orders never hang around forever."""
    order = get_order(db, user, market_id, order_id)
    as_seller(order, user, *order_flow.MISSED)
    order_flow.end(db, order, OrderStatus.SELLER_ENDED, order.price)
    db.commit()
    tell(
        db,
        order,
        order.buyer,
        f"{user.display_name} ended {order.product_name}. You got a full refund.",
    )
    return order_view(order, user)
