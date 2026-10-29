# 2026-10-29: Currency decisions

- Merged PR #1 (dev environment and backend skeleton). Phase 1 setup is on `main`.
- Installed the GitHub CLI so Claude can open pull requests.
- Agreed on a way of working: I make the high-level decisions, Claude does the building, step by step.
- Decided how currency works (see decision 0008): starting amount and allowance as market settings, no debt for now, direct transfers off by default, equal members, one person can be in several markets.
- Compared backend languages (Python, TypeScript) and databases (PostgreSQL, MongoDB, SQLite). Kept Python and accepted PostgreSQL (decision 0007).
- From now on I make the technical choices too, from options with pros and cons.
- Compared plain SQL, SQLAlchemy, and SQLModel. Chose SQLAlchemy with Alembic (decision 0009).
- Decided real login comes first, through a login service instead of building our own (decision 0010).
- Next: choose which login service, then build markets, members, and balances in the backend.
