"""Deletes markets that have been empty for 30 days.

There's no always-on timer (see decision 0017), so this runs alongside normal requests,
at most once a day per server process. A market is deleted at least 30 days after it empties.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Invite, LedgerEntry, Market, Membership

DELETE_EMPTY_AFTER = timedelta(days=30)
RUN_EVERY = timedelta(days=1)

log = logging.getLogger(__name__)
_last_run: datetime | None = None


def delete_old_empty_markets(db: Session) -> int:
    """Deletes markets archived more than 30 days ago, with everything in them."""
    cutoff = datetime.now(UTC) - DELETE_EMPTY_AFTER
    market_ids = db.scalars(select(Market.id).where(Market.archived_at <= cutoff)).all()
    if not market_ids:
        return 0

    memberships = select(Membership.id).where(Membership.market_id.in_(market_ids))
    db.execute(delete(LedgerEntry).where(LedgerEntry.membership_id.in_(memberships)))
    db.execute(delete(Invite).where(Invite.market_id.in_(market_ids)))
    db.execute(delete(Membership).where(Membership.market_id.in_(market_ids)))
    db.execute(delete(Market).where(Market.id.in_(market_ids)))
    db.commit()
    return len(market_ids)


def run_daily_cleanup() -> None:
    """Runs the cleanup if it hasn't run in the last day. Never breaks the request it rides on."""
    global _last_run
    now = datetime.now(UTC)
    if _last_run is not None and now - _last_run < RUN_EVERY:
        return
    _last_run = now
    try:
        with SessionLocal() as db:
            deleted = delete_old_empty_markets(db)
        if deleted:
            log.info("Deleted %d empty markets.", deleted)
    except Exception:
        log.exception("Cleanup failed. It will try again tomorrow.")
