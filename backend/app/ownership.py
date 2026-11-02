"""Product owners, and changes that every owner must approve (decision 0021, section 1).

A product can have several owners. Changing its name or description, closing it, and adding
or removing an owner are requests: the person asking approves by asking, every other owner
must approve too, and any decline cancels it. Someone being added must also accept. With a
single owner, a request is approved the moment it's made. Requests expire after a time the
person asking picks.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import store
from app.models import (
    Membership,
    Product,
    ProductOwner,
    ProductRequest,
    RequestApproval,
    RequestKind,
    RequestStatus,
    User,
)


def owner_ids(product: Product) -> set[int]:
    return {o.user_id for o in product.owners}


def is_owner(product: Product, user: User) -> bool:
    return user.id in owner_ids(product)


def approvers(request: ProductRequest) -> set[int]:
    """Everyone who must approve: the current owners, plus someone being added (they accept),
    minus someone being removed."""
    needed = owner_ids(request.product)
    if request.kind == RequestKind.ADD_OWNER:
        needed.add(request.member_id)
    if request.kind == RequestKind.REMOVE_OWNER:
        needed.discard(request.member_id)
    return needed


def approved_by(request: ProductRequest) -> set[int]:
    return {a.user_id for a in request.approvals}


def waiting_for(request: ProductRequest) -> set[int]:
    return approvers(request) - approved_by(request)


def is_active_member(db: Session, market_id: int, user_id: int) -> bool:
    return (
        db.scalar(
            select(Membership.id).where(
                Membership.market_id == market_id,
                Membership.user_id == user_id,
                Membership.left_at.is_(None),
            )
        )
        is not None
    )


def apply(db: Session, request: ProductRequest) -> None:
    product = request.product
    if request.kind == RequestKind.EDIT:
        if request.new_name is not None:
            product.name = request.new_name
        if request.new_description is not None:
            product.description = request.new_description
    elif request.kind == RequestKind.CLOSE:
        store.close_now(product)
    elif request.kind == RequestKind.ADD_OWNER:
        if request.member_id not in owner_ids(product) and is_active_member(
            db, product.market_id, request.member_id
        ):
            product.owners.append(ProductOwner(user_id=request.member_id))
    elif request.kind == RequestKind.REMOVE_OWNER:
        product.owners = [o for o in product.owners if o.user_id != request.member_id]
        # What they asked for no longer has an owner behind it.
        for other in pending(product):
            if other.requested_by_id == request.member_id:
                other.status = RequestStatus.CANCELLED


def finish_if_approved(db: Session, request: ProductRequest) -> bool:
    """Makes the change once everyone has approved. The caller commits. Returns whether it did."""
    if request.status != RequestStatus.PENDING or waiting_for(request):
        return False
    request.status = RequestStatus.APPROVED
    apply(db, request)
    db.flush()
    return True


def ask(db: Session, product: Product, by: User, kind: RequestKind, expires_in: int, **fields):
    """Makes a request, approved by the person asking. The caller commits."""
    request = ProductRequest(
        product=product,
        kind=kind,
        requested_by=by,
        expires_at=store.expires_in(expires_in),
        **fields,
    )
    request.approvals.append(RequestApproval(user_id=by.id))
    db.add(request)
    db.flush()
    finish_if_approved(db, request)
    return request


def pending(product: Product) -> list[ProductRequest]:
    return [r for r in product.requests if r.status == RequestStatus.PENDING]


def leave(db: Session, market_id: int, user_id: int) -> None:
    """Someone left the market: they stop owning its products. Their own requests, and requests
    to add them, are cancelled. Requests that were only waiting for them go through.
    The caller commits."""
    products = db.scalars(
        select(Product)
        .join(ProductOwner)
        .where(Product.market_id == market_id, ProductOwner.user_id == user_id)
    ).all()
    for product in products:
        product.owners = [o for o in product.owners if o.user_id != user_id]
    requests = db.scalars(
        select(ProductRequest)
        .join(Product)
        .where(Product.market_id == market_id, ProductRequest.status == RequestStatus.PENDING)
    ).all()
    for request in requests:
        if request.requested_by_id == user_id or request.member_id == user_id:
            request.status = RequestStatus.CANCELLED
    db.flush()
    for request in requests:
        finish_if_approved(db, request)


def expire(db: Session, market_id: int) -> bool:
    """Expires requests nobody finished answering in time. Returns whether any did."""
    requests = db.scalars(
        select(ProductRequest)
        .join(Product)
        .where(
            Product.market_id == market_id,
            ProductRequest.status == RequestStatus.PENDING,
            ProductRequest.expires_at <= store.now(),
        )
    ).all()
    for request in requests:
        request.status = RequestStatus.EXPIRED
    return bool(requests)
