"""Old apps: every request from the app says which version it is, and the backend asks apps
older than `MIN_APP_VERSION` to update instead of letting them break (decision 0029).

The version is a whole number in the app (APP_VERSION in frontend/src/config.ts), raised only
when a backend change can't keep older apps working. Then `MIN_APP_VERSION` is raised in Vercel
once the new app is out. Apps that don't send it (versions before this check) count as 0.
"""

from app.config import settings

HEADER = "X-App-Version"
MESSAGE = "This version of vagora is too old. Please update."  # Shown if the app has no screen for it.

# Always answered: the health check (it carries no app version) and GitHub's release calls.
OPEN = ("/health", "/internal/")


def version_of(header: str | None) -> int:
    """The app's version from its header; 0 when missing or unreadable."""
    try:
        return int(header or 0)
    except ValueError:
        return 0


def too_old(path: str, header: str | None) -> bool:
    """Whether a request comes from an app older than the minimum."""
    if path.startswith(OPEN):
        return False
    return version_of(header) < settings.min_app_version
