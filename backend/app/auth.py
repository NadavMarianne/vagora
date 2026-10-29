"""Login: checks the Firebase token that the app sends with each request."""

from dataclasses import dataclass
from functools import cache
from typing import Annotated, Any

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials
from google.auth.credentials import AnonymousCredentials

from app.config import settings

bearer = HTTPBearer(auto_error=False)


class _NoSecretKey(credentials.Base):
    """Checking tokens uses only Google's public certificates, so no secret key is needed.

    Without this, Firebase looks for a key file on startup and fails.
    """

    def get_credential(self) -> AnonymousCredentials:
        return AnonymousCredentials()


@dataclass(frozen=True)
class FirebaseUser:
    """Who Firebase says is making the request."""

    uid: str
    email: str | None


@cache
def _firebase_app() -> firebase_admin.App:
    return firebase_admin.initialize_app(
        _NoSecretKey(), options={"projectId": settings.firebase_project_id}
    )


def verify_token(token: str) -> dict[str, Any]:
    """Checks a token's signature, expiry, and project, and returns what it says.

    Tests replace this function, so they never call Firebase.
    """
    return auth.verify_id_token(token, app=_firebase_app())


def get_firebase_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> FirebaseUser:
    """Use as a dependency on any endpoint that needs a logged-in person."""
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in.")

    try:
        claims = verify_token(credentials.credentials)
    except auth.CertificateFetchError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Can't check logins right now. Try again soon."
        ) from error
    except (ValueError, auth.InvalidIdTokenError) as error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login is invalid or expired.") from error

    if not claims.get("email_verified"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please verify your email first.")

    return FirebaseUser(uid=claims["uid"], email=claims.get("email"))
