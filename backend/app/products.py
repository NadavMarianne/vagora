"""Store endpoints for products and proposals (decision 0021, sections 1 and 2).

Any member creates a product and proposes it to sellers at a price. Each seller accepts (with
their own terms, which makes an offer) or declines. The product is live once it has an offer.
"""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import signals, store
from app.markets import get_membership
from app.models import CoinMode, Membership, Offer, Product, Proposal, ProposalStatus, User
from app.store import OfferTerms, OfferView, Price
from app.users import CurrentUser, DbSession, Username

router = APIRouter(prefix="/markets/{market_id}", tags=["store"])

ProductName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
# How long sellers have to answer: 10 seconds to 30 days.
ProposalExpiry = Annotated[int, Field(ge=10, le=30 * 24 * 3600)]


class ProductCreate(BaseModel):
    name: ProductName
    description: Description = ""
    coin_mode: CoinMode
    price: Price
    proposal_expiry_seconds: ProposalExpiry = 3 * 24 * 3600
    # Who gets a proposal. The creator sells it too by sending `my_offer` (their own terms).
    sellers: list[Username] = []
    my_offer: OfferTerms | None = None


class ProductUpdate(BaseModel):
    name: ProductName | None = None
    description: Description | None = None


class ProposalsCreate(BaseModel):
    sellers: list[Username] = Field(min_length=1)
    price: Price


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
    expires_at: datetime


ProductStatus = Literal["waiting", "live", "no_sellers", "closed"]


class ProductSummary(BaseModel):
    id: int
    name: str
    description: str
    coin_mode: str
    status: ProductStatus
    creator_username: str
    creator_display_name: str
    is_mine: bool
    offer_count: int
    lowest_price: int | None


class ProductView(ProductSummary):
    proposal_expiry_seconds: int
    offers: list[OfferView]
    # Only the creator sees the proposals.
    proposals: list[ProposalView]


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
        "is_mine": product.creator_id == user.id,
        "offer_count": len(offers),
        "lowest_price": offers[0].price if offers else None,
    }


def product_view(product: Product, user: User) -> ProductView:
    is_creator = product.creator_id == user.id
    return ProductView(
        **summary_fields(product, user),
        proposal_expiry_seconds=product.proposal_expiry_seconds,
        offers=[store.offer_view(o, user.id) for o in live_offers(product)],
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
        if is_creator
        else [],
    )


def open_store(db: Session, user: User, market_id: int) -> Membership:
    """Your membership, after the store has caught up on anything whose time is up."""
    membership = get_membership(db, user, market_id)
    if store.catch_up(db, market_id):
        db.commit()
    return membership


def get_product(db: Session, market_id: int, product_id: int) -> Product:
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.market_id == market_id)
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    return product


def get_my_product(db: Session, user: User, market_id: int, product_id: int) -> Product:
    product = get_product(db, market_id, product_id)
    if product.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the product's creator can do this.")
    return product


def propose(
    db: Session, product: Product, usernames: list[str], price: int, by: User
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
                expires_at=store.expires_in(product.proposal_expiry_seconds),
            )
        )
        sellers.append(seller)
    return sellers


def tell_sellers(db: Session, product: Product, sellers: list[User], by: User) -> None:
    signals.notify_market(db, product.market_id)
    signals.notify(
        [s.firebase_uid for s in sellers],
        f"market:{product.market_id}",
        f"{by.display_name} asks you to sell {product.name}",
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
    db.add(product)
    if new.my_offer is not None:
        offer = Offer(product=product, seller=user, price=new.price)
        store.apply_terms(offer, new.my_offer)
        db.add(offer)
    sellers = propose(db, product, new.sellers, new.price, by=user)
    db.commit()
    tell_sellers(db, product, sellers, by=user)
    return product_view(product, user)


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
    return product_view(get_product(db, market_id, product_id), user)


@router.patch("/products/{product_id}")
def change_product(
    market_id: int, product_id: int, changes: ProductUpdate, user: CurrentUser, db: DbSession
) -> ProductView:
    """The creator can change the name and description."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    for field, value in changes.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    signals.notify_market(db, market_id)
    return product_view(product, user)


@router.post("/products/{product_id}/close")
def close_product(market_id: int, product_id: int, user: CurrentUser, db: DbSession) -> ProductView:
    """Stops new proposals and removes offers without a commitment. Committed offers stay until
    their commitment is released."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    if product.closed_at is None:
        product.closed_at = store.now()
        store.end_offers_and_proposals(
            [o for o in product.offers if o.removed_at is None],
            [p for p in product.proposals if p.status == ProposalStatus.PENDING],
        )
        db.commit()
        signals.notify_market(db, market_id)
    return product_view(product, user)


@router.post("/products/{product_id}/proposals", status_code=status.HTTP_201_CREATED)
def send_proposals(
    market_id: int, product_id: int, new: ProposalsCreate, user: CurrentUser, db: DbSession
) -> ProductView:
    """The creator proposes the product to more sellers, or again to one who declined."""
    open_store(db, user, market_id)
    product = get_my_product(db, user, market_id, product_id)
    sellers = propose(db, product, new.sellers, new.price, by=user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "They already have a proposal.") from error
    tell_sellers(db, product, sellers, by=user)
    return product_view(product, user)


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
        [product.creator.firebase_uid],
        f"market:{market_id}",
        f"{user.display_name} now sells {product.name}",
    )
    return product_view(product, user)


@router.post("/proposals/{proposal_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_proposal(market_id: int, proposal_id: int, user: CurrentUser, db: DbSession) -> None:
    open_store(db, user, market_id)
    proposal = get_my_proposal(db, user, market_id, proposal_id)
    proposal.status = ProposalStatus.DECLINED
    db.commit()
    product = proposal.product
    signals.notify_market(db, market_id)
    signals.notify(
        [product.creator.firebase_uid],
        f"market:{market_id}",
        f"{user.display_name} declined to sell {product.name}",
    )
