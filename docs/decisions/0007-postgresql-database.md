# 0007: PostgreSQL as the database

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Use PostgreSQL for storage. The dev environment already runs one in a container.

## Why
Coin balances and orders must stay correct. PostgreSQL handles safe multi-step changes well, which suits a market with currency in it: a purchase either fully happens or not at all. The data is full of links (people, markets, balances, purchases), which tables handle naturally. Flexible market settings can still be stored as JSON. It uses standard SQL, which the author already knows.

## Alternatives considered
- MongoDB: flexible documents, but links between data are less natural, and keeping coins exactly right during a purchase takes more work.
- SQLite: simplest to start (one file), but weak with many users at once and awkward to host online.

## Still open
Which free hosting service will run it. (The Python library is chosen in decision 0009.)
