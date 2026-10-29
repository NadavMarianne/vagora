# 0009: SQLAlchemy and Alembic for database access

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Python code talks to PostgreSQL through SQLAlchemy. Changes to the database structure (new tables, new columns) are saved as Alembic migration files and kept in Git.

## Why
SQLAlchemy is the standard Python database library, widely used in real jobs. Tables are described as Python classes, so the editor catches mistakes, and plain SQL is still possible when it is clearer. Alembic keeps the local, test, and online databases in the same shape.

## Alternatives considered
- Plain SQL with psycopg: familiar and fully visible, but every query and its conversion to Python is written by hand, and typos only show up when the code runs.
- SQLModel: less code and made to fit FastAPI, but newer with fewer answers online, and problems lead back to SQLAlchemy anyway.
