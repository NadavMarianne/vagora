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

import firebase_admin
from firebase_admin import credentials, firestore
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Membership, User

log = logging.getLogger(__name__)


@cache
def _client():
    """The Firestore client, or None when no key is set (tests and local development)."""
    if not settings.firebase_service_account:
        log.info("FIREBASE_SERVICE_ACCOUNT isn't set, so live updates are off.")
        return None
    key = json.loads(settings.firebase_service_account)
    app = firebase_admin.initialize_app(credentials.Certificate(key), name="signals")
    return firestore.client(app)


def notify(firebase_uids: Iterable[str], reason: str, message: str = "") -> None:
    """Tells these people's apps that something changed.

    `reason` says what, like "invite" or "market:12". `message` is shown as a banner when set.
    """
    uids = set(firebase_uids)
    if not uids:
        return
    try:
        client = _client()
        if client is None:
            return
        batch = client.batch()
        for uid in uids:
            note = {"at": firestore.SERVER_TIMESTAMP, "reason": reason, "message": message}
            batch.set(client.collection("signals").document(uid), note)
        batch.commit(timeout=5)
    except Exception:
        log.exception("Couldn't send live updates (%s).", reason)


def market_members(db: Session, market_id: int) -> list[str]:
    """The Firebase IDs of everyone currently in a market."""
    return list(
        db.scalars(
            select(User.firebase_uid)
            .join(Membership, Membership.user_id == User.id)
            .where(Membership.market_id == market_id, Membership.left_at.is_(None))
        )
    )


def notify_market(db: Session, market_id: int, message: str = "", but: User | None = None) -> None:
    """Tells everyone in a market that something in it changed.

    `but` leaves out the person who made the change, so they get no banner about their own action.
    """
    members = market_members(db, market_id)
    if but is not None:
        members = [uid for uid in members if uid != but.firebase_uid]
    notify(members, f"market:{market_id}", message)
