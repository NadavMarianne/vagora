"""Your notifications: every message you were sent, kept until you dismiss it.

They're saved by `signals.notify`, so they're here even if your app was closed when they came.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select, update

from app.models import Notification
from app.users import CurrentUser, DbSession

router = APIRouter(prefix="/notifications", tags=["notifications"])

# The list shows this many, newest first.
LIST_SIZE = 100


class NotificationView(BaseModel):
    id: int
    message: str
    # The app page it opens, like "/markets/12/orders/3".
    path: str
    created_at: datetime
    read: bool


def mine(user_id: int):
    return Notification.user_id == user_id


@router.get("")
def list_notifications(user: CurrentUser, db: DbSession) -> list[NotificationView]:
    """Your notifications, newest first."""
    notifications = db.scalars(
        select(Notification)
        .where(mine(user.id))
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(LIST_SIZE)
    )
    return [
        NotificationView(
            id=n.id,
            message=n.message,
            path=n.path,
            created_at=n.created_at,
            read=n.read_at is not None,
        )
        for n in notifications
    ]


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: int, user: CurrentUser, db: DbSession) -> None:
    notification = db.scalar(
        select(Notification).where(mine(user.id), Notification.id == notification_id)
    )
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        db.commit()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: CurrentUser, db: DbSession) -> None:
    db.execute(
        update(Notification)
        .where(mine(user.id), Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    db.commit()


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss(notification_id: int, user: CurrentUser, db: DbSession) -> None:
    db.execute(delete(Notification).where(mine(user.id), Notification.id == notification_id))
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_all(user: CurrentUser, db: DbSession) -> None:
    db.execute(delete(Notification).where(mine(user.id)))
    db.commit()
