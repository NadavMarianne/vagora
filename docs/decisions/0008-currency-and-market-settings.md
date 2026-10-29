# 0008: Currency and market settings

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Each market has its own currency, and its rules are settings chosen by the market, not code. The first version supports:

| Setting | What it does | Default |
|---|---|---|
| Currency name | What the market calls its coins | Chosen when the market is created |
| Starting amount | Coins each member gets when they join | Set by the market |
| Allowance | Coins each member gets regularly | Set by the market (amount and how often) |
| Debt | Whether a balance can go below zero | Not supported yet: balances never go below zero |
| Direct transfers | Whether members can send coins to each other | Off |

Members and markets:
- All members of a market are equal. Any member can change its settings.
- One person can belong to several markets.

## Why
The platform is meant to let anyone create their own market, so the rules must be configurable from the start. Only the settings the first market needs are built now, to keep it simple. Debt adds hard questions (limits, what happens when it isn't paid back), so it waits. Equal members is the simplest model for a two-person market.

## Later
- More ways to earn, starting with earning through tasks.
- Optional debt.
- Roles such as owner or admin, for bigger markets.
