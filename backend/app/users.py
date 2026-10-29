"""Profile endpoints: "who am I?" and first-time profile setup."""

from typing import Annotated

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


class ProfileSetup(BaseModel):
    username: Username
    display_name: DisplayName


class Profile(BaseModel):
    username: str
    display_name: str


def find_user(db: Session, firebase_uid: str) -> User | None:
    return db.scalar(select(User).where(User.firebase_uid == firebase_uid))


@router.get("/me")
def get_me(login: CurrentLogin, db: DbSession) -> Profile:
    """Returns your profile, or 404 if you still need to set it up."""
    user = find_user(db, login.uid)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not set up yet.")
    return Profile(username=user.username, display_name=user.display_name)


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
    return Profile(username=user.username, display_name=user.display_name)
