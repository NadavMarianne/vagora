# 0007: PostgreSQL as the database

**Date:** 2026-10-29 **Status:** Proposed

## Decision
Use PostgreSQL for storage. The dev environment already runs one in a container.

## Why
Coin balances and orders must stay correct. PostgreSQL handles safe multi-step changes well, which suits a market with currency in it.

## Still open
Which free hosting service will run it, and which Python library connects to it. This record stays "Proposed" until the first database code is written.
