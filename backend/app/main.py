from fastapi import FastAPI, Request
from starlette.concurrency import run_in_threadpool

from app import cleanup, invites, markets, users

app = FastAPI(title="vagora", version="0.0.1")
app.include_router(users.router)
app.include_router(markets.router)
app.include_router(invites.router)


@app.middleware("http")
async def daily_cleanup(request: Request, call_next):
    """Piggybacks the once-a-day cleanup on normal use (see app/cleanup.py)."""
    await run_in_threadpool(cleanup.run_daily_cleanup)
    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    """Tells us the backend is up. Used by tests now, and by hosting later."""
    return {"status": "ok"}
