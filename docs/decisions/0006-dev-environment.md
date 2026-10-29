# 0006: Development environment

**Date:** 2026-10-29 **Status:** Accepted

## Decision
- Work happens inside a **devcontainer** (VS Code + Docker), with a second container for the database.
- Code style is checked with **Ruff**, tests run with **pytest**.
- **pre-commit** runs the checks before each commit and enforces Conventional Commit messages.
- **GitHub Actions** runs lint, format check, and tests on every pull request.
- **Dependabot** keeps dependencies up to date.

## Why
Anyone can open the repo and get the same working setup. Mistakes are caught early and automatically, and the whole setup is documented in the repo.

## Alternatives considered
Installing everything directly on the computer (works, but is not repeatable and not easy to show off).
