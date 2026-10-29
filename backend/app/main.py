from fastapi import FastAPI

app = FastAPI(title="vagora", version="0.0.1")


@app.get("/health")
def health() -> dict[str, str]:
    """Tells us the backend is up. Used by tests now, and by hosting later."""
    return {"status": "ok"}
