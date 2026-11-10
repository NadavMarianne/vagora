"""Releases: GitHub tells the backend that a new app version is out (decision 0029).

After a release publishes an over-the-air update, the release workflow calls this with the
release password, and every open app updates right away, like a game kicking everyone out to
update. Nothing else can call it.
"""

import hmac
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from app import signals
from app.config import settings

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/app-updated", status_code=status.HTTP_204_NO_CONTENT)
def app_updated(x_release_secret: Annotated[str, Header()] = "") -> None:
    """Announces a new app version to every open app."""
    secret = settings.release_secret
    if not secret or not hmac.compare_digest(x_release_secret.encode(), secret.encode()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed.")
    signals.announce_new_version()
