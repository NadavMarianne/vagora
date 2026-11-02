"""Store endpoints for product owners and their requests (decision 0021, section 1).

Any owner can sell the product themselves, invite a co-owner, ask to remove one, or step down.
Changes that need everyone's approval are requests (see app/ownership.py), answered here.
"""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ownership, signals, store
from app.models import (
    Membership,
    Offer,
    Product,
    ProductOwner,
    ProductRequest,
    Proposal,
    RequestApproval,
    RequestKind,
    RequestStatus,
    User,
)
from app.products import (
    THREE_DAYS,
    AnswerTime,
    ProductView,
    get_my_product,
    get_product,
    open_store,
    product_view,
    tell_owners,
)
from app.store import OfferTerms, Price
from app.users import CurrentUser, DbSession, Username

router = APIRouter(prefix="/markets/{market_id}", tags=["store"])


class OwnerInvite(BaseModel):
    username: Username
    expires_in_seconds: AnswerTime = THREE_DAYS


class OwnerRemoval(BaseModel):
    expires_in_seconds: AnswerTime = THREE_DAYS


class MyOffer(BaseModel):
    price: Price
    terms: OfferTerms


class WaitingRequestView(BaseModel):
    """A request in this market waiting for your answer."""

    id: int
    product_id: int
    product_name: str
    kind: str
    requested_by_display_name: str
    member_display_name: str | None
    # Whether you're the one asked to co-own it.
    asks_you_to_own: bool
    expires_at: datetime


def active_member(db: Session, market_id: int, username: str) -> User:
    member = db.scalar(
        select(User)
        .join(Membership, Membership.user_id == User.id)
        .where(
            User.username == username,
            Membership.market_id == market_id,
            Membership.left_at.is_(None),
        )
    )
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{username} isn't in this market.")
    return member


def conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


@router.post("/products/{product_id}/my-offer", status_code=status.HTTP_201_CREATED)
def sell_it_myself(
    market_id: int, product_id: int, new: MyOffer, user: CurrentUser, db: DbSession
) -> ProductView:
    """An owner sells the product themselves, with no proposal needed."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    if product.closed_at is not None:
        raise conflict("This product is closed.")
    if db.scalar(
        store.active_offers().where(Offer.product_id == product.id, Offer.seller_id == user.id)
    ):
        raise conflict("You already sell it.")
    if db.scalar(
        store.pending_proposals().where(
            Proposal.product_id == product.id, Proposal.seller_id == user.id
        )
    ):
        raise conflict("You have a proposal for it waiting. Answer that instead.")
    offer = Offer(product=product, seller=user, price=new.price)
    store.apply_terms(offer, new.terms)
    db.add(offer)
    db.commit()
    signals.notify_market(db, market_id)
    return product_view(product, user, db)


@router.post("/products/{product_id}/owners", status_code=status.HTTP_201_CREATED)
def invite_owner(
    market_id: int, product_id: int, invite: OwnerInvite, user: CurrentUser, db: DbSession
) -> ProductView:
    """Asks a member to co-own the product. They accept, and every owner must approve."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    member = active_member(db, market_id, invite.username)
    if ownership.is_owner(product, member):
        raise conflict(f"{member.display_name} already owns it.")
    if any(
        r.kind == RequestKind.ADD_OWNER and r.member_id == member.id
        for r in ownership.pending(product)
    ):
        raise conflict(f"{member.display_name} was already asked.")
    request = ownership.ask(
        db, product, user, RequestKind.ADD_OWNER, invite.expires_in_seconds, member_id=member.id
    )
    db.commit()
    message = f"{user.display_name} wants {member.display_name} to co-own {product.name}"
    tell_owners(db, product, request, message)
    return product_view(product, user, db)


@router.delete("/products/{product_id}/owners/{username}")
def remove_owner(
    market_id: int,
    product_id: int,
    username: str,
    user: CurrentUser,
    db: DbSession,
    removal: OwnerRemoval | None = None,
) -> ProductView:
    """Stepping down yourself happens at once, unless you're the only owner. Removing someone
    else needs every other owner to approve."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    if username == user.username:
        if len(product.owners) == 1:
            raise conflict("You're the only owner. Add another owner before stepping down.")
        product.owners = [o for o in product.owners if o.user_id != user.id]
        db.flush()
        # Requests that only waited for you can go through now.
        for request in ownership.pending(product):
            if request.requested_by_id == user.id:
                request.status = RequestStatus.CANCELLED
            else:
                ownership.finish_if_approved(db, request)
        db.commit()
        signals.notify_market(db, market_id)
        return product_view(product, user, db)

    member = next((o.user for o in product.owners if o.user.username == username), None)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{username} doesn't own it.")
    if any(
        r.kind == RequestKind.REMOVE_OWNER and r.member_id == member.id
        for r in ownership.pending(product)
    ):
        raise conflict(f"Removing {member.display_name} is already waiting for approval.")
    expires_in = (removal or OwnerRemoval()).expires_in_seconds
    request = ownership.ask(
        db, product, user, RequestKind.REMOVE_OWNER, expires_in, member_id=member.id
    )
    db.commit()
    message = f"{user.display_name} wants to remove {member.display_name} from {product.name}"
    tell_owners(db, product, request, message)
    return product_view(product, user, db)


@router.post("/products/{product_id}/claim")
def claim(market_id: int, product_id: int, user: CurrentUser, db: DbSession) -> ProductView:
    """A seller takes over a product that has no owners left."""
    open_store(db, user, market_id)
    product = get_product(db, market_id, product_id)
    db.refresh(product, with_for_update=True)
    if product.owners:
        raise conflict("This product has an owner.")
    if not db.scalar(
        store.active_offers().where(Offer.product_id == product.id, Offer.seller_id == user.id)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only its sellers can claim it.")
    product.owners.append(ProductOwner(user=user))
    db.commit()
    signals.notify_market(db, market_id)
    return product_view(product, user, db)


def get_request(db: Session, user: User, market_id: int, request_id: int) -> ProductRequest:
    request = db.scalar(
        select(ProductRequest)
        .join(Product)
        .where(ProductRequest.id == request_id, Product.market_id == market_id)
        .with_for_update(of=ProductRequest)
    )
    if request is None or request.status != RequestStatus.PENDING:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This request isn't waiting any more.")
    return request


def answerable(request: ProductRequest, user: User) -> None:
    if user.id not in ownership.waiting_for(request):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This request isn't waiting for you.")


@router.post("/product-requests/{request_id}/approve")
def approve(market_id: int, request_id: int, user: CurrentUser, db: DbSession) -> ProductView:
    open_store(db, user, market_id)
    request = get_request(db, user, market_id, request_id)
    answerable(request, user)
    request.approvals.append(RequestApproval(user_id=user.id))
    db.flush()
    done = ownership.finish_if_approved(db, request)
    db.commit()
    product = request.product
    if done:
        signals.notify_market(db, market_id, f"{product.name} was changed", but=user)
    else:
        signals.notify_market(db, market_id)
    return product_view(product, user, db)


@router.post("/product-requests/{request_id}/decline")
def decline(market_id: int, request_id: int, user: CurrentUser, db: DbSession) -> ProductView:
    open_store(db, user, market_id)
    request = get_request(db, user, market_id, request_id)
    answerable(request, user)
    request.status = RequestStatus.DECLINED
    db.commit()
    signals.notify(
        [request.requested_by.firebase_uid],
        f"market:{market_id}",
        f"{user.display_name} declined your request for {request.product.name}",
    )
    signals.notify_market(db, market_id)
    return product_view(request.product, user, db)


@router.delete("/product-requests/{request_id}")
def cancel_request(
    market_id: int, request_id: int, user: CurrentUser, db: DbSession
) -> ProductView:
    """The person who asked takes it back."""
    open_store(db, user, market_id)
    request = get_request(db, user, market_id, request_id)
    if request.requested_by_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the person who asked can cancel it.")
    request.status = RequestStatus.CANCELLED
    db.commit()
    signals.notify_market(db, market_id)
    return product_view(request.product, user, db)


@router.get("/product-requests")
def waiting_requests(market_id: int, user: CurrentUser, db: DbSession) -> list[WaitingRequestView]:
    """Requests in this market waiting for your answer."""
    open_store(db, user, market_id)
    requests = db.scalars(
        select(ProductRequest)
        .join(Product)
        .where(Product.market_id == market_id, ProductRequest.status == RequestStatus.PENDING)
        .order_by(ProductRequest.id)
    )
    return [
        WaitingRequestView(
            id=r.id,
            product_id=r.product_id,
            product_name=r.product.name,
            kind=r.kind,
            requested_by_display_name=r.requested_by.display_name,
            member_display_name=r.member.display_name if r.member else None,
            asks_you_to_own=r.kind == RequestKind.ADD_OWNER and r.member_id == user.id,
            expires_at=r.expires_at,
        )
        for r in requests
        if user.id in ownership.waiting_for(r)
    ]
