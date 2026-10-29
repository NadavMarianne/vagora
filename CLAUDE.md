# CLAUDE.md

Guidance for Claude (and anyone else) working on this repo.

## Project
**vagora** is a platform for creating small market systems: a currency, a shop, and ways to earn. It starts as a private market for two people and is designed to become a configurable platform. See `docs/vision.md`.

## Workflow
1. Plan strategy and goals, 2. split work into organized sections, 3. integrate and run final tests, 4. release the first version.
- Phase 1 is the environment: dev setup, file structure, pipelines, automatic tests.
- Git and GitHub for everything. Work happens on branches and goes into `main` through pull requests. `main` is protected.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Document the process as we go: decisions go in `docs/decisions/`, work sessions in `docs/devlog/`.

## Decisions so far
See `docs/decisions/`. In short: Python with FastAPI (Pydantic, Ruff, pytest), one backend plus one database, no microservices, virtual currency only, one market first.

## Repo layout
- `backend/`: FastAPI app (`app/`), tests (`tests/`), and Alembic migrations (`migrations/`), configured in `pyproject.toml`
- `docs/`: vision, decision records (`decisions/`), build diary (`devlog/`), setup guide
- `.devcontainer/`: dev environment (app container plus PostgreSQL)
- `.github/`: CI workflow, Dependabot, issue and PR templates

## Commands (run inside the devcontainer)
`make run`, `make test`, `make lint`, `make format`, `make migrate`, `make migration name="..."`

## Rules
- Keep it simple. No new complexity without a real need.
- Settings, not code: markets, items, prices, and earning rules should be configurable data.
- Backend first and API-based, so any frontend can be replaced later.
- Never commit secrets (keys, passwords).
- No real money features.
- PostgreSQL is proposed (decision 0007). The frontend and hosting choices are still open. Do not assume them.
- Every PR should keep CI green (lint, format check, tests).

## Communication
The owner is learning as he builds. Keep explanations short and in plain words, and say what to do, why, and what to write in the devlog.
