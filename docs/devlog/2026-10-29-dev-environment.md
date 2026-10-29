# 2026-10-29: Dev environment

- Added a devcontainer (Python 3.12) with a PostgreSQL container beside it.
- Created the backend skeleton: one `/health` endpoint and one test.
- Added Ruff, pytest, pre-commit (including commit message checks), and a GitHub Actions workflow.
- Added Dependabot and issue and pull request templates.
- Wrote `docs/setup.md` and decision records 0006 and 0007.

Next: open the repo in the container, confirm tests and CI pass, then turn on "require status checks" for `main`.
