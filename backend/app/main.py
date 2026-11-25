import logging

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app import (
    app_version,
    cleanup,
    db,
    hands,
    invites,
    limits,
    markets,
    notifications,
    offers,
    orders,
    owners,
    products,
    releases,
    tables,
    time_zones,
    users,
)
from app.config import settings

log = logging.getLogger(__name__)

app = FastAPI(title="vagora", version="0.0.1")
app.include_router(users.router)
app.include_router(markets.router)
app.include_router(invites.router)
app.include_router(limits.router)
app.include_router(notifications.router)
app.include_router(products.router)
app.include_router(offers.router)
app.include_router(owners.router)
app.include_router(orders.router)
app.include_router(orders.everywhere)
app.include_router(time_zones.router)
app.include_router(releases.router)
app.include_router(tables.router)
app.include_router(hands.router)


@app.middleware("http")
async def daily_cleanup(request: Request, call_next):
    """Piggybacks the once-a-day cleanup on normal use (see app/cleanup.py)."""
    await run_in_threadpool(cleanup.run_daily_cleanup)
    return await call_next(request)


@app.middleware("http")
async def too_old_apps(request: Request, call_next):
    """Asks apps older than the minimum version to update (see app/app_version.py)."""
    if app_version.too_old(request.url.path, request.headers.get(app_version.HEADER)):
        return JSONResponse(
            status_code=status.HTTP_426_UPGRADE_REQUIRED,
            content={"detail": app_version.MESSAGE, "apk_url": settings.apk_url or None},
        )
    return await call_next(request)


@app.get("/health")
def health(response: Response) -> dict[str, str]:
    """Checks that the backend and the database both answer.

    The app calls this as soon as it opens, which also wakes a sleeping database.
    """
    try:
        with db.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        log.exception("Health check: the database didn't answer.")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "error", "database": "unreachable"}
    return {"status": "ok", "database": "ok"}
