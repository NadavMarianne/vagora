# 0002: Backend in Python with FastAPI

**Date:** 2026-10-29 **Status:** Accepted

## Decision
The backend is written in Python using FastAPI, with Pydantic for validation, Ruff for linting and formatting, and pytest for tests.

## Why
The author already knows these tools well, so progress is faster and mistakes are cheaper. They also fit this kind of project (an API with business rules and a database).

## Alternatives considered
TypeScript (would require learning a new language first) and C (poor fit for web APIs).
