"""Profile endpoints: "who am I?", first-time profile setup, and changing your profile."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, get_firebase_user
from app.db import get_db
from app.models import User

router = APIRouter()

CurrentLogin = Annotated[FirebaseUser, Depends(get_firebase_user)]
DbSession = Annotated[Session, Depends(get_db)]

# 3 to 20 letters, numbers, or underscores. Case is ignored (stored in lowercase).
Username = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, pattern=r"^[A-Za-z0-9_]{3,20}$")
]
# 1 to 30 characters of anything (spaces, emojis, Hebrew), trimmed at both ends.
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


# The app's looks, in the order the app shows them. Night is the default.
Theme = Literal["night", "clean", "warm", "velvet", "neon", "paper", "pop"]


class ProfileSetup(BaseModel):
    username: Username
    display_name: DisplayName


class ProfileUpdate(BaseModel):
    """What to change. Leave out anything that stays the same."""

    display_name: DisplayName | None = None
    theme: Theme | None = None


class Profile(BaseModel):
    username: str
    display_name: str
    theme: str


def profile(user: User) -> Profile:
    return Profile(username=user.username, display_name=user.display_name, theme=user.theme)


def find_user(db: Session, firebase_uid: str) -> User | None:
    return db.scalar(select(User).where(User.firebase_uid == firebase_uid))


def get_current_user(login: CurrentLogin, db: DbSession) -> User:
    """Use as a dependency on endpoints that need a set-up profile."""
    user = find_user(db, login.uid)
    if user is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Set up your profile first.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/me")
def get_me(login: CurrentLogin, db: DbSession) -> Profile:
    """Returns your profile, or 404 if you still need to set it up."""
    user = find_user(db, login.uid)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not set up yet.")
    return profile(user)


@router.post("/me", status_code=status.HTTP_201_CREATED)
def set_up_profile(setup: ProfileSetup, login: CurrentLogin, db: DbSession) -> Profile:
    """Creates your vagora profile after your first log-in."""
    if find_user(db, login.uid) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Profile already set up.")

    user = User(firebase_uid=login.uid, username=setup.username, display_name=setup.display_name)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        # The database refuses duplicates, even when two requests arrive at the same moment.
        db.rollback()
        if find_user(db, login.uid) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Profile already set up.") from error
        raise HTTPException(status.HTTP_409_CONFLICT, "Username is taken.") from error
    return profile(user)


@router.patch("/me")
def change_profile(update: ProfileUpdate, user: CurrentUser, db: DbSession) -> Profile:
    """Changes your display name or the app's look. Your username stays the same."""
    for field, value in update.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return profile(user)
