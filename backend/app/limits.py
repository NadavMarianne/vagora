"""Member pages and limits files (decision 0022).

Each member's limits file lists what's never allowed for them. Everyone in the market can see
it. Setting it the first time is free, and so is the first edit after that. Later, an edit that
adds or changes anything costs the market's price (the coins vanish); an edit that only removes
lines is always free. Lines are never deleted, only marked removed, so the court can see the file
as it was at any moment.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger, signals
from app.markets import active_memberships, get_membership
from app.models import EntryKind, LimitItem, Membership, User
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/markets/{market_id}", tags=["members"])

Line = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]


class LimitsUpdate(BaseModel):
    """Your whole limits file, one line each. Empty lines are dropped."""

    lines: list[Line]


class MemberPage(BaseModel):
    username: str
    display_name: str
    joined_at: datetime
    is_me: bool
    # Their limits file: what's never allowed for them.
    limits: list[str]
    # Only on your own page: whether you've set it yet, and what your next edit would cost
    # (removing lines is always free).
    limits_set: bool | None = None
    next_edit_cost: int | None = None


def current_lines(db: Session, membership: Membership) -> list[LimitItem]:
    return list(
        db.scalars(
            select(LimitItem)
            .where(LimitItem.membership_id == membership.id, LimitItem.removed_at.is_(None))
            .order_by(LimitItem.added_at, LimitItem.id)
        )
    )


def edit_cost(membership: Membership) -> int:
    """What an edit that adds or changes lines costs now. The setup and the first edit are free."""
    if membership.limits_set_at is None or membership.limits_edits == 0:
        return 0
    return membership.market.limits_edit_price


def page(db: Session, membership: Membership, viewer: User) -> MemberPage:
    is_me = membership.user_id == viewer.id
    return MemberPage(
        username=membership.user.username,
        display_name=membership.user.display_name,
        joined_at=membership.joined_at,
        is_me=is_me,
        limits=[item.text for item in current_lines(db, membership)],
        limits_set=membership.limits_set_at is not None if is_me else None,
        next_edit_cost=edit_cost(membership) if is_me else None,
    )


@router.get("/members/{username}")
def member_page(market_id: int, username: str, user: CurrentUser, db: DbSession) -> MemberPage:
    """A member's page, with their limits file."""
    get_membership(db, user, market_id)
    membership = db.scalar(
        active_memberships()
        .join(User, User.id == Membership.user_id)
        .where(Membership.market_id == market_id, User.username == username)
    )
    if membership is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "They're not in this market.")
    return page(db, membership, user)


@router.put("/limits")
def save_limits(
    market_id: int, update: LimitsUpdate, user: CurrentUser, db: DbSession
) -> MemberPage:
    """Saves your whole limits file as one edit.

    A line that's no longer there is removed; a new or changed line is added. If anything is
    added and this isn't free, the edit costs the market's price.
    """
    membership = get_membership(db, user, market_id)
    db.refresh(membership, with_for_update=True)
    wanted = list(dict.fromkeys(line for line in update.lines if line))
    current = current_lines(db, membership)
    kept = {item.text for item in current}
    added = [line for line in wanted if line not in kept]
    removed = [item for item in current if item.text not in wanted]
    first_time = membership.limits_set_at is None

    if added and not first_time:
        cost = edit_cost(membership)
        if cost > 0:
            try:
                ledger.record(db, membership, -cost, EntryKind.LIMITS_EDIT, "Edited your limits")
            except ledger.NotEnoughCoins as error:
                db.rollback()
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"Editing costs {cost}, and you don't have enough. Removing lines is free.",
                ) from error
        membership.limits_edits += 1

    now = datetime.now(UTC)
    if first_time:
        membership.limits_set_at = now
    for item in removed:
        item.removed_at = now
    db.add_all(LimitItem(membership_id=membership.id, text=line, added_at=now) for line in added)
    db.commit()
    if added or removed:
        signals.notify_market(db, market_id)
    return page(db, membership, user)
