"""Live updates: tells people's apps that something changed for them (decision 0020).

For each person there's one small note in Firestore, `signals/{firebase uid}`. The backend
rewrites it when something changes for them, and their app, listening to it, reloads what's on
screen at once. The note only says *that* something changed; the real data stays in our database.

Notes are best effort: if one fails to send, the action itself still succeeds, and the app
catches up the next time it loads a screen.
"""

import json
import logging
from collections.abc import Iterable
from functools import cache
from typing import Literal

import firebase_admin
from firebase_admin import credentials, firestore
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Membership, Notification, User

log = logging.getLogger(__name__)

# How important a message is. The app colors it to match:
# "critical" red (disputes, cancellations, refusals), "warning" orange (missed or expired
# deadlines), "good" green (done, paid, a new seller), and "info" blue (everything else).
Level = Literal["info", "good", "warning", "critical"]


@cache
def _client():
    """The Firestore client, or None when no key is set (tests and local development)."""
    if not settings.firebase_service_account:
        log.info("FIREBASE_SERVICE_ACCOUNT isn't set, so live updates are off.")
        return None
    key = json.loads(settings.firebase_service_account)
    app = firebase_admin.initialize_app(credentials.Certificate(key), name="signals")
    return firestore.client(app)


def notify(
    db: Session,
    firebase_uids: Iterable[str],
    reason: str,
    message: str = "",
    path: str = "",
    level: Level = "info",
) -> None:
    """Tells these people's apps that something changed.

    `reason` says what, like "invite" or "market:12". `message` is shown as a banner when set,
    and tapping the banner opens `path`, the app page it's about, like "/markets/12/orders/3".
    A message is also saved in each person's notifications list, so it's there later even if
    their app was closed. Call this after the action itself was committed.
    """
    uids = set(firebase_uids)
    if not uids:
        return
    ids = save(db, uids, message, path, level) if message else {}
    try:
        client = _client()
        if client is None:
            return
        batch = client.batch()
        for uid in uids:
            note = {
                "at": firestore.SERVER_TIMESTAMP,
                "reason": reason,
                "message": message,
                "path": path,
                "level": level,
                # The saved notification, so tapping the banner can mark it read.
                "id": ids.get(uid),
            }
            batch.set(client.collection("signals").document(uid), note)
        batch.commit(timeout=5)
    except Exception:
        log.exception("Couldn't send live updates (%s).", reason)


def save(db: Session, uids: set[str], message: str, path: str, level: Level) -> dict[str, int]:
    """Saves a notification for each of these people. Returns each one's ID by Firebase ID."""
    try:
        users = db.scalars(select(User).where(User.firebase_uid.in_(uids))).all()
        saved = {
            u.firebase_uid: Notification(
                user_id=u.id, message=message[:200], path=path[:200], level=level
            )
            for u in users
        }
        db.add_all(saved.values())
        db.commit()
        return {uid: n.id for uid, n in saved.items()}
    except SQLAlchemyError:
        db.rollback()
        log.exception("Couldn't save notifications.")
        return {}


def market_members(db: Session, market_id: int) -> list[str]:
    """The Firebase IDs of everyone currently in a market."""
    return list(
        db.scalars(
            select(User.firebase_uid)
            .join(Membership, Membership.user_id == User.id)
            .where(Membership.market_id == market_id, Membership.left_at.is_(None))
        )
    )


def notify_market(
    db: Session, market_id: int, message: str = "", but: User | None = None, path: str = ""
) -> None:
    """Tells everyone in a market that something in it changed.

    `but` leaves out the person who made the change, so they get no banner about their own action.
    The banner opens `path`, or the market's page if there's none.
    """
    members = market_members(db, market_id)
    if but is not None:
        members = [uid for uid in members if uid != but.firebase_uid]
    notify(db, members, f"market:{market_id}", message, path or f"/markets/{market_id}")
