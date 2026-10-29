# 0012: Git workflow and environments

**Date:** 2026-10-29 **Status:** Accepted

## Decision
- One repository. `main` is the official version and must always work.
- Every change goes through a branch and a pull request, then "Squash and merge" into `main` (GitHub Flow).
- `main` is protected on GitHub: it cannot be deleted or force-pushed, changes need a pull request, and the CI check (`backend`) must pass before merging.
- Production is a place the app runs, not a separate repo. Releases are marked as version tags on `main` (for example `v0.1.0`).
- Each environment gets its own services and data, starting with Firebase: `vagora-dev` for development, `vagora-prod` created when we go live.

## Why
One repo keeps a single source of truth. Separate repos for production drift apart over time. Squash merging keeps the history to one line per pull request. Separate environments mean testing never touches real users or real data.

## Alternatives considered
- A separate repo for production: rejected because the copies drift.
- Git Flow (a long-lived `develop` branch beside `main`): more ceremony than a small project needs.
