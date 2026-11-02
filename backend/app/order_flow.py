"""How orders end, and what happens to their held coins (decision 0021, sections 4 to 6).

When an order is bought, its price leaves the buyer's balance and is held by the order. When it
ends, the held coins go back to the buyer (a refund), to the seller, or vanish, following the
product's coin mode. Each order ends exactly once.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger
from app.models import CoinMode, EntryKind, Membership, Order, OrderStatus

# After the seller says "I did it", the order completes on its own this long later, unless the
# buyer disputes it first.
AUTO_COMPLETE_AFTER = timedelta(days=3)

ACTIVE = (OrderStatus.OPEN, OrderStatus.DONE_CLAIMED, OrderStatus.DISPUTED)


def membership(db: Session, order: Order, user_id: int) -> Membership:
    """A membership of the order's buyer or seller, even if they've left (coins wait frozen)."""
    return db.scalar(
        select(Membership).where(
            Membership.market_id == order.market_id, Membership.user_id == user_id
        )
    )


def share(price: int, percent: int) -> int:
    """`percent` of `price`, rounded to the nearest whole coin."""
    return (price * percent + 50) // 100


def end(
    db: Session, order: Order, status: OrderStatus, refund: int, at: datetime | None = None
) -> None:
    """Ends the order: `refund` coins go back to the buyer, and the rest of the held price goes
    to the seller or vanishes, by the product's coin mode. The caller commits."""
    name = order.product_name
    if refund > 0:
        buyer = membership(db, order, order.buyer_id)
        ledger.record(db, buyer, refund, EntryKind.REFUND, f"Refund for {name}", at=at)
    rest = order.price - refund
    if rest > 0 and order.coin_mode == CoinMode.TO_SELLER:
        seller = membership(db, order, order.seller_id)
        note = f"Sold {name} to {order.buyer.display_name}"
        ledger.record(db, seller, rest, EntryKind.SALE, note[:100], at=at)
    order.status = status
    order.ended_at = at or datetime.now(UTC)


def auto_complete_at(order: Order) -> datetime | None:
    if order.status != OrderStatus.DONE_CLAIMED or order.done_claimed_at is None:
        return None
    return order.done_claimed_at + AUTO_COMPLETE_AFTER


def catch_up(db: Session, market_id: int, at: datetime) -> list[Order]:
    """Ends orders whose time is up. The caller commits. Returns the orders that ended.

    - "I did it" with no dispute for 3 days: completed.
    - "On request" never asked for before its validity ended: expired. A refundable one gives
      back its refund percentage.
    Fixed deadlines that pass are handled with missed deadlines (decision 0021, step 3).
    """
    ended = []
    orders = db.scalars(
        select(Order)
        .where(
            Order.market_id == market_id,
            Order.status.in_([OrderStatus.OPEN, OrderStatus.DONE_CLAIMED]),
        )
        .with_for_update(skip_locked=True)
    )
    for order in orders:
        completes = auto_complete_at(order)
        if completes is not None and completes <= at:
            end(db, order, OrderStatus.COMPLETED, 0, at=completes)
            ended.append(order)
        elif (
            order.status == OrderStatus.OPEN
            and order.delivery == "on_request"
            and order.due_at <= at
        ):
            refund = share(order.price, order.refund_percent) if order.refundable else 0
            end(db, order, OrderStatus.EXPIRED, refund, at=order.due_at)
            ended.append(order)
    return ended
