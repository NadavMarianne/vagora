"""Invite endpoints: members invite people by username, who then accept or decline."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.markets import MarketView, active_memberships, add_member, get_membership, view
from app.models import Invite, InviteStatus, Membership, User
from app.users import CurrentUser, DbSession, Username

router = APIRouter(tags=["invites"])

# The inviter picks how long the invite lasts: 1 hour to 30 days, 7 days if not given.
ExpiresInHours = Annotated[int, Field(ge=1, le=30 * 24)]


class InviteCreate(BaseModel):
    username: Username
    expires_in_hours: ExpiresInHours = 7 * 24


class PendingInviteView(BaseModel):
    """An open invite as the market's members see it: who is invited, not who invited them."""

    id: int
    invited_username: str
    invited_display_name: str
    expires_at: datetime


class ReceivedInviteView(BaseModel):
    """An invite as the invited person sees it: which market, and who invited them."""

    id: int
    market_id: int
    market_name: str
    invited_by_username: str
    invited_by_display_name: str
    expires_at: datetime


def pending_view(invite: Invite) -> PendingInviteView:
    return PendingInviteView(
        id=invite.id,
        invited_username=invite.invited_user.username,
        invited_display_name=invite.invited_user.display_name,
        expires_at=invite.expires_at,
    )


def received_view(invite: Invite) -> ReceivedInviteView:
    return ReceivedInviteView(
        id=invite.id,
        market_id=invite.market_id,
        market_name=invite.market.name,
        invited_by_username=invite.invited_by.username,
        invited_by_display_name=invite.invited_by.display_name,
        expires_at=invite.expires_at,
    )


def now() -> datetime:
    return datetime.now(UTC)


def open_invites():
    """Invites that can still be accepted: pending and not expired."""
    return select(Invite).where(Invite.status == InviteStatus.PENDING, Invite.expires_at > now())


@router.post("/markets/{market_id}/invites", status_code=status.HTTP_201_CREATED)
def send_invite(
    market_id: int, new: InviteCreate, user: CurrentUser, db: DbSession
) -> PendingInviteView:
    """Invites someone to the market by their username. Any member can invite."""
    membership = get_membership(db, user, market_id)
    invited = db.scalar(select(User).where(User.username == new.username))
    if invited is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No one has that username.")

    # Former members can be invited back. They return with their frozen coins.
    already_member = db.scalar(
        active_memberships().where(
            Membership.market_id == market_id, Membership.user_id == invited.id
        )
    )
    if already_member is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "They're already in this market.")

    pending = db.scalar(
        select(Invite).where(
            Invite.market_id == market_id,
            Invite.invited_user_id == invited.id,
            Invite.status == InviteStatus.PENDING,
        )
    )
    if pending is not None:
        if pending.expires_at > now():
            raise HTTPException(status.HTTP_409_CONFLICT, "They already have an invite.")
        pending.status = InviteStatus.EXPIRED

    invite = Invite(
        market=membership.market,
        invited_user=invited,
        invited_by=user,
        expires_at=now() + timedelta(hours=new.expires_in_hours),
    )
    db.add(invite)
    try:
        db.commit()
    except IntegrityError as error:
        # Two members invited the same person at the same moment.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "They already have an invite.") from error
    return pending_view(invite)


@router.get("/markets/{market_id}/invites")
def list_market_invites(
    market_id: int, user: CurrentUser, db: DbSession
) -> list[PendingInviteView]:
    """Invites from this market that are still waiting for an answer."""
    get_membership(db, user, market_id)
    invites = db.scalars(
        open_invites().where(Invite.market_id == market_id).order_by(Invite.created_at)
    )
    return [pending_view(invite) for invite in invites]


@router.delete("/markets/{market_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_invite(market_id: int, invite_id: int, user: CurrentUser, db: DbSession) -> None:
    """Any member can cancel an invite that hasn't been answered yet."""
    get_membership(db, user, market_id)
    invite = db.scalar(open_invites().where(Invite.id == invite_id, Invite.market_id == market_id))
    if invite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found.")
    invite.status = InviteStatus.CANCELLED
    db.commit()


@router.get("/invites")
def list_my_invites(user: CurrentUser, db: DbSession) -> list[ReceivedInviteView]:
    """Invites waiting for your answer."""
    invites = db.scalars(
        open_invites().where(Invite.invited_user_id == user.id).order_by(Invite.created_at)
    )
    return [received_view(invite) for invite in invites]


def get_my_open_invite(db: Session, user: User, invite_id: int) -> Invite:
    invite = db.scalar(
        select(Invite).where(Invite.id == invite_id, Invite.invited_user_id == user.id)
    )
    if invite is None or invite.status != InviteStatus.PENDING:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found.")
    if invite.expires_at <= now():
        invite.status = InviteStatus.EXPIRED
        db.commit()
        raise HTTPException(status.HTTP_410_GONE, "This invite has expired.")
    return invite


@router.post("/invites/{invite_id}/accept")
def accept_invite(invite_id: int, user: CurrentUser, db: DbSession) -> MarketView:
    """Joins the market: the starting amount for newcomers, frozen coins for those coming back."""
    invite = get_my_open_invite(db, user, invite_id)
    invite.status = InviteStatus.ACCEPTED
    try:
        membership = add_member(db, invite.market, user, invited_by=invite.invited_by)
        db.commit()
    except IntegrityError as error:
        # The same invite accepted twice at the same moment (a double tap).
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already in this market.") from error
    return view(membership)


@router.post("/invites/{invite_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_invite(invite_id: int, user: CurrentUser, db: DbSession) -> None:
    invite = get_my_open_invite(db, user, invite_id)
    invite.status = InviteStatus.DECLINED
    db.commit()
