# 0003: Simple architecture, no microservices

**Date:** 2026-10-29 **Status:** Accepted

## Decision
vagora is three parts: an app screen (frontend), one backend, and one database. The backend is organized into clean internal modules (coins, shop, orders, rules), but it is deployed as a single service.

## Why
The app is not complex enough to justify many services. Microservices would add a lot of plumbing, make free hosting hard, and slow down a solo developer. Currency changes also need to happen safely in one step, which is much simpler with one database.

## Alternatives considered
Microservices (separate services for ledger, rules, orders, notifications). Rejected as too complicated for now. Clean module boundaries keep the option open if it is ever needed.
