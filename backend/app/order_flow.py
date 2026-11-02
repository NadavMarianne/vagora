"""How orders end, and what happens to their held coins (decision 0021, sections 4 to 6).

When an order is bought, its price leaves the buyer's balance and is held by the order. When it
ends, the held coins go back to the buyer (a refund), to the seller, or vanish, following the
product's coin mode. Each order ends exactly once.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger, signals
from app.models import CoinMode, EntryKind, Membership, Order, OrderStatus

# After the seller says "I did it", the order completes on its own this long later, unless the
# buyer disputes it first.
AUTO_COMPLETE_AFTER = timedelta(days=3)

# After a missed deadline: the buyer is choosing (or simply waiting), or asked for a new deadline.
MISSED = (OrderStatus.MISSED, OrderStatus.NEW_DEADLINE_ASKED)

# Orders that haven't ended yet. The coins are still held.
ACTIVE = (
    OrderStatus.OPEN,
    OrderStatus.DONE_CLAIMED,
    OrderStatus.DISPUTED,
    *MISSED,
    OrderStatus.CANCEL_PENDING,
)


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


def catch_up(db: Session, market_id: int, at: datetime) -> list[tuple[Order, str]]:
    """Moves orders on whose time is up. The caller commits, then calls `announce` with what
    this returns: each changed order and what happened to it.

    - "I did it" with no dispute for 3 days: completed.
    - "On request" never asked for before its validity ended: expired. A refundable one gives
      back its refund percentage.
    - A fixed deadline that passed: missed, and the buyer chooses what happens next.
    - A new deadline the seller didn't answer in time: missed again, back to choosing.
    - A cancellation after a missed deadline that the seller didn't contest: fully refunded.
    """
    changed = []
    orders = db.scalars(
        select(Order)
        .where(
            Order.market_id == market_id,
            Order.status.in_(
                [
                    OrderStatus.OPEN,
                    OrderStatus.DONE_CLAIMED,
                    OrderStatus.NEW_DEADLINE_ASKED,
                    OrderStatus.CANCEL_PENDING,
                ]
            ),
        )
        .with_for_update(skip_locked=True)
    )
    for order in orders:
        completes = auto_complete_at(order)
        if completes is not None and completes <= at:
            end(db, order, OrderStatus.COMPLETED, 0, at=completes)
            changed.append((order, "completed"))
        elif order.status == OrderStatus.OPEN and order.due_at <= at:
            if order.delivery == "on_request":
                refund = share(order.price, order.refund_percent) if order.refundable else 0
                end(db, order, OrderStatus.EXPIRED, refund, at=order.due_at)
                changed.append((order, "expired"))
            else:
                miss(order, at=order.due_at)
                changed.append((order, "missed"))
        elif order.status == OrderStatus.NEW_DEADLINE_ASKED and order.new_deadline_answer_by <= at:
            back_to_choosing(order)
            changed.append((order, "no_answer"))
        elif order.status == OrderStatus.CANCEL_PENDING and order.contest_until <= at:
            end(db, order, OrderStatus.NOT_DELIVERED, order.price, at=order.contest_until)
            changed.append((order, "not_delivered"))
    return changed


def announce(changes: list[tuple[Order, str]]) -> None:
    """Tells the buyer and the seller when an order's time ran out, with a banner that opens it.
    Call after committing."""
    for order, what in changes:
        name = order.product_name
        paid = "You were paid." if order.coin_mode == CoinMode.TO_SELLER else ""
        buyer_news, seller_news = {
            "missed": (
                f"The deadline for {name} passed",
                f"You missed the deadline for {name}",
            ),
            "expired": (
                f"{name} expired unused",
                f"{order.buyer.display_name}'s {name} expired unused",
            ),
            "completed": (
                f"{name} now counts as done",
                f"{name} now counts as done. {paid}".strip(),
            ),
            "not_delivered": (
                f"You got a full refund for {name}",
                f"{name} was refunded: the time to contest ran out",
            ),
            "no_answer": (
                f"No answer to your new deadline for {name}",
                f"The new deadline for {name} ran out unanswered",
            ),
        }[what]
        reason = f"market:{order.market_id}"
        path = f"/markets/{order.market_id}/orders/{order.id}"
        signals.notify([order.buyer.firebase_uid], reason, buyer_news, path)
        signals.notify([order.seller.firebase_uid], reason, seller_news, path)


def miss(order: Order, at: datetime) -> None:
    """The deadline was missed: the time ran out, or the buyer said the seller refused."""
    order.status = OrderStatus.MISSED
    order.missed_at = at
    order.missed_count += 1


def back_to_choosing(order: Order) -> None:
    """A proposed new deadline was declined or not answered: the buyer chooses again."""
    order.status = OrderStatus.MISSED
    order.new_deadline_seconds = None
    order.new_deadline_asked_at = None
    order.new_deadline_answer_by = None
