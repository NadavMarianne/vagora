"""Store endpoints for products and proposals (decision 0021, sections 1 and 2).

Any member creates a product and proposes it to sellers at a price. Each seller accepts (with
their own terms, which makes an offer) or declines. The product is live once it has an offer.
A product can have several owners (see app/ownership.py and app/owners.py).
"""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import ownership, signals, store
from app.markets import get_membership
from app.models import (
    CoinMode,
    Membership,
    Offer,
    Product,
    ProductOwner,
    ProductRequest,
    Proposal,
    ProposalStatus,
    RequestKind,
    RequestStatus,
    User,
)
from app.store import OfferTerms, OfferView, Price
from app.users import CurrentUser, DbSession, Username

router = APIRouter(prefix="/markets/{market_id}", tags=["store"])

ProductName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
# How long people have to answer a proposal or a request: 10 seconds to 30 days.
AnswerTime = Annotated[int, Field(ge=10, le=30 * 24 * 3600)]
THREE_DAYS = 3 * 24 * 3600


class ProductCreate(BaseModel):
    name: ProductName
    description: Description = ""
    coin_mode: CoinMode
    price: Price
    proposal_expiry_seconds: AnswerTime = THREE_DAYS
    # Who gets a proposal. The creator sells it too by sending `my_offer` (their own terms).
    sellers: list[Username] = []
    my_offer: OfferTerms | None = None


class ProductUpdate(BaseModel):
    name: ProductName | None = None
    description: Description | None = None
    # With several owners, how long the others have to approve.
    expires_in_seconds: AnswerTime = THREE_DAYS


class CloseRequest(BaseModel):
    expires_in_seconds: AnswerTime = THREE_DAYS


class ProposalsCreate(BaseModel):
    sellers: list[Username] = Field(min_length=1)
    price: Price
    # How long they have to answer. Without it, the time chosen when the product was created.
    expires_in_seconds: AnswerTime | None = None


class ProposalView(BaseModel):
    """A proposal as the product's creator sees it."""

    id: int
    seller_username: str
    seller_display_name: str
    price: int
    status: str
    expires_at: datetime


class MyProposalView(BaseModel):
    """A proposal waiting for your answer."""

    id: int
    product_id: int
    product_name: str
    product_description: str
    coin_mode: str
    creator_display_name: str
    price: int
    created_at: datetime
    expires_at: datetime


ProductStatus = Literal["waiting", "live", "no_sellers", "closed"]


class PersonView(BaseModel):
    username: str
    display_name: str


class RequestView(BaseModel):
    """A change waiting for approval. Owners see these, and so does someone being added."""

    id: int
    kind: str
    requested_by: PersonView
    # Who's being added or removed.
    member: PersonView | None
    new_name: str | None
    new_description: str | None
    approved: list[PersonView]
    waiting_for: list[PersonView]
    # Whether it waits for your answer, and whether you asked for it.
    mine_to_answer: bool
    mine: bool
    created_at: datetime
    expires_at: datetime


class ProductSummary(BaseModel):
    id: int
    name: str
    description: str
    coin_mode: str
    status: ProductStatus
    creator_username: str
    creator_display_name: str
    # Whether you own it.
    is_mine: bool
    offer_count: int
    lowest_price: int | None


class ProductView(ProductSummary):
    proposal_expiry_seconds: int
    offers: list[OfferView]
    owners: list[PersonView]
    # Only owners see the proposals.
    proposals: list[ProposalView]
    requests: list[RequestView]
    # A seller can claim a product that has no owners left.
    can_claim: bool


def live_offers(product: Product) -> list[Offer]:
    return sorted(
        (o for o in product.offers if o.removed_at is None), key=lambda o: (o.price, o.id)
    )


def product_status(product: Product, offers: list[Offer]) -> ProductStatus:
    if product.closed_at is not None:
        return "closed"
    if offers:
        return "live"
    if any(p.status == ProposalStatus.PENDING for p in product.proposals):
        return "waiting"
    return "no_sellers"


def summary_fields(product: Product, user: User) -> dict:
    offers = live_offers(product)
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "coin_mode": product.coin_mode,
        "status": product_status(product, offers),
        "creator_username": product.creator.username,
        "creator_display_name": product.creator.display_name,
        "is_mine": ownership.is_owner(product, user),
        "offer_count": len(offers),
        "lowest_price": offers[0].price if offers else None,
    }


def person(user: User) -> PersonView:
    return PersonView(username=user.username, display_name=user.display_name)


def request_view(db: Session, request: ProductRequest, user: User) -> RequestView:
    def people(ids: set[int]) -> list[PersonView]:
        if not ids:
            return []
        return [person(u) for u in db.scalars(select(User).where(User.id.in_(ids)))]

    waiting = ownership.waiting_for(request)
    return RequestView(
        id=request.id,
        kind=request.kind,
        requested_by=person(request.requested_by),
        member=person(request.member) if request.member else None,
        new_name=request.new_name,
        new_description=request.new_description,
        approved=people(ownership.approved_by(request)),
        waiting_for=people(waiting),
        mine_to_answer=user.id in waiting,
        mine=request.requested_by_id == user.id,
        created_at=request.created_at,
        expires_at=request.expires_at,
    )


def product_view(product: Product, user: User, db: Session) -> ProductView:
    is_owner = ownership.is_owner(product, user)
    offers = live_offers(product)
    return ProductView(
        **summary_fields(product, user),
        proposal_expiry_seconds=product.proposal_expiry_seconds,
        offers=[store.offer_view(o, user.id) for o in offers],
        owners=[person(o.user) for o in product.owners],
        requests=[
            request_view(db, r, user)
            for r in ownership.pending(product)
            if is_owner or user.id in ownership.approvers(r)
        ],
        can_claim=not product.owners and any(o.seller_id == user.id for o in offers),
        proposals=[
            ProposalView(
                id=p.id,
                seller_username=p.seller.username,
                seller_display_name=p.seller.display_name,
                price=p.price,
                status=p.status,
                expires_at=p.expires_at,
            )
            for p in reversed(product.proposals)
        ]
        if is_owner
        else [],
    )


def open_store(db: Session, user: User, market_id: int) -> Membership:
    """Your membership. Getting it catches the market up on anything whose time is up."""
    return get_membership(db, user, market_id)


def get_product(db: Session, market_id: int, product_id: int) -> Product:
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.market_id == market_id)
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    return product


def get_my_product(db: Session, user: User, market_id: int, product_id: int) -> Product:
    """A product you own. Locked, so two changes to it can't happen at once."""
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id, Product.market_id == market_id)
        .with_for_update()
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    if not ownership.is_owner(product, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the product's owners can do this.")
    return product


def propose(
    db: Session,
    product: Product,
    usernames: list[str],
    price: int,
    by: User,
    expires_in: int | None = None,
) -> list[User]:
    """Sends proposals to these members. Refuses anyone who already sells it or has one waiting.

    The caller commits. Returns the people proposed to.
    """
    if product.closed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This product is closed.")
    sellers = []
    for username in dict.fromkeys(usernames):
        seller = db.scalar(
            select(User)
            .join(Membership, Membership.user_id == User.id)
            .where(
                User.username == username,
                Membership.market_id == product.market_id,
                Membership.left_at.is_(None),
            )
        )
        if seller is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"{username} isn't in this market.")
        if seller.id == by.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "To sell it yourself, add your own offer."
            )
        sells = db.scalar(
            store.active_offers().where(
                Offer.product_id == product.id, Offer.seller_id == seller.id
            )
        )
        waiting = db.scalar(
            store.pending_proposals().where(
                Proposal.product_id == product.id, Proposal.seller_id == seller.id
            )
        )
        if sells is not None or waiting is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{seller.display_name} already sells it or has a proposal.",
            )
        db.add(
            Proposal(
                product=product,
                seller=seller,
                price=price,
                expires_at=store.expires_in(expires_in or product.proposal_expiry_seconds),
            )
        )
        sellers.append(seller)
    return sellers


def product_path(product: Product) -> str:
    return f"/markets/{product.market_id}/store/{product.id}"


def tell_sellers(db: Session, product: Product, sellers: list[User], by: User) -> None:
    """Refreshes everyone's screens. Each new seller gets a banner that opens their proposal."""
    signals.notify_market(db, product.market_id)
    asked = {s.id for s in sellers}
    for proposal in product.proposals:
        if proposal.status == ProposalStatus.PENDING and proposal.seller_id in asked:
            signals.notify(
                [proposal.seller.firebase_uid],
                f"market:{product.market_id}",
                f"{by.display_name} asks you to sell {product.name}",
                f"/markets/{product.market_id}/proposals/{proposal.id}",
            )


@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_product(
    market_id: int, new: ProductCreate, user: CurrentUser, db: DbSession
) -> ProductView:
    """Creates a product, sends proposals to the chosen sellers, and adds your own offer if any."""
    open_store(db, user, market_id)
    if not new.sellers and new.my_offer is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick at least one seller, or sell it yourself."
        )
    product = Product(
        market_id=market_id,
        creator=user,
        name=new.name,
        description=new.description,
        coin_mode=new.coin_mode,
        proposal_expiry_seconds=new.proposal_expiry_seconds,
    )
    product.owners.append(ProductOwner(user=user))
    db.add(product)
    if new.my_offer is not None:
        offer = Offer(product=product, seller=user, price=new.price)
        store.apply_terms(offer, new.my_offer)
        db.add(offer)
    sellers = propose(db, product, new.sellers, new.price, by=user)
    db.commit()
    tell_sellers(db, product, sellers, by=user)
    return product_view(product, user, db)


@router.get("/products")
def list_products(market_id: int, user: CurrentUser, db: DbSession) -> list[ProductSummary]:
    """The market's products, newest first."""
    open_store(db, user, market_id)
    products = db.scalars(
        select(Product).where(Product.market_id == market_id).order_by(Product.id.desc())
    )
    return [ProductSummary(**summary_fields(p, user)) for p in products]


@router.get("/products/{product_id}")
def get_product_details(
    market_id: int, product_id: int, user: CurrentUser, db: DbSession
) -> ProductView:
    """A product with its offers, cheapest first."""
    open_store(db, user, market_id)
    return product_view(get_product(db, market_id, product_id), user, db)


@router.patch("/products/{product_id}")
def change_product(
    market_id: int, product_id: int, changes: ProductUpdate, user: CurrentUser, db: DbSession
) -> ProductView:
    """Changes the name or description. With several owners, the others must approve first."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    if changes.name is None and changes.description is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nothing to change.")
    request = ownership.ask(
        db,
        product,
        user,
        RequestKind.EDIT,
        changes.expires_in_seconds,
        new_name=changes.name,
        new_description=changes.description,
    )
    db.commit()
    tell_owners(db, product, request, f"{user.display_name} wants to edit {product.name}")
    return product_view(product, user, db)


@router.post("/products/{product_id}/close")
def close_product(
    market_id: int,
    product_id: int,
    user: CurrentUser,
    db: DbSession,
    close: CloseRequest | None = None,
) -> ProductView:
    """Stops new proposals and removes offers without a commitment. Committed offers stay until
    their commitment is released. With several owners, the others must approve first."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    if product.closed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This product is already closed.")
    if any(r.kind == RequestKind.CLOSE for r in ownership.pending(product)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Closing it is already waiting for approval.")
    expires_in = (close or CloseRequest()).expires_in_seconds
    request = ownership.ask(db, product, user, RequestKind.CLOSE, expires_in)
    db.commit()
    tell_owners(db, product, request, f"{user.display_name} wants to close {product.name}")
    return product_view(product, user, db)


def tell_owners(db: Session, product: Product, request: ProductRequest, message: str) -> None:
    """Refreshes everyone's screens. If the request still waits, the people it waits for get a
    banner."""
    signals.notify_market(db, product.market_id)
    waiting = ownership.waiting_for(request) if request.status == RequestStatus.PENDING else set()
    if waiting:
        uids = db.scalars(select(User.firebase_uid).where(User.id.in_(waiting)))
        signals.notify(uids, f"market:{product.market_id}", message, product_path(product))


@router.post("/products/{product_id}/proposals", status_code=status.HTTP_201_CREATED)
def send_proposals(
    market_id: int, product_id: int, new: ProposalsCreate, user: CurrentUser, db: DbSession
) -> ProductView:
    """Any owner proposes the product to more sellers, or again to one who declined."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    sellers = propose(
        db, product, new.sellers, new.price, by=user, expires_in=new.expires_in_seconds
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "They already have a proposal.") from error
    tell_sellers(db, product, sellers, by=user)
    return product_view(product, user, db)


@router.get("/proposals")
def my_proposals(market_id: int, user: CurrentUser, db: DbSession) -> list[MyProposalView]:
    """Proposals in this market waiting for your answer."""
    open_store(db, user, market_id)
    proposals = db.scalars(
        store.pending_proposals()
        .join(Product)
        .where(Product.market_id == market_id, Proposal.seller_id == user.id)
        .order_by(Proposal.created_at)
    )
    return [
        MyProposalView(
            id=p.id,
            product_id=p.product_id,
            product_name=p.product.name,
            product_description=p.product.description,
            coin_mode=p.product.coin_mode,
            creator_display_name=p.product.creator.display_name,
            price=p.price,
            created_at=p.created_at,
            expires_at=p.expires_at,
        )
        for p in proposals
    ]


def get_my_proposal(db: Session, user: User, market_id: int, proposal_id: int) -> Proposal:
    proposal = db.scalar(
        store.pending_proposals()
        .join(Product)
        .where(
            Proposal.id == proposal_id,
            Product.market_id == market_id,
            Proposal.seller_id == user.id,
        )
        .with_for_update(of=Proposal)
    )
    if proposal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This proposal isn't waiting any more.")
    return proposal


@router.post("/proposals/{proposal_id}/accept")
def accept_proposal(
    market_id: int, proposal_id: int, terms: OfferTerms, user: CurrentUser, db: DbSession
) -> ProductView:
    """Accepts a proposal with your terms. This makes your offer, at the proposal's price."""
    open_store(db, user, market_id)
    proposal = get_my_proposal(db, user, market_id, proposal_id)
    product = proposal.product
    proposal.status = ProposalStatus.ACCEPTED
    offer = Offer(product=product, seller=user, price=proposal.price)
    store.apply_terms(offer, terms)
    db.add(offer)
    db.commit()
    signals.notify_market(db, market_id)
    signals.notify(
        [o.user.firebase_uid for o in product.owners],
        f"market:{market_id}",
        f"{user.display_name} now sells {product.name}",
        product_path(product),
    )
    return product_view(product, user, db)


@router.post("/proposals/{proposal_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_proposal(market_id: int, proposal_id: int, user: CurrentUser, db: DbSession) -> None:
    open_store(db, user, market_id)
    proposal = get_my_proposal(db, user, market_id, proposal_id)
    proposal.status = ProposalStatus.DECLINED
    db.commit()
    product = proposal.product
    signals.notify_market(db, market_id)
    signals.notify(
        [o.user.firebase_uid for o in product.owners],
        f"market:{market_id}",
        f"{user.display_name} declined to sell {product.name}",
        product_path(product),
    )
