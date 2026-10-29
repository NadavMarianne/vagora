# 0016: Ledger and balances

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Coins are tracked with a **ledger plus a stored balance**:

```
users ──< memberships >── markets
              │
              └──< ledger entries
```

- A **membership** is "this user is in this market". It holds the stored balance for that market, since one person has a separate balance in each market.
- A **ledger entry** is one movement of coins, belonging to exactly one membership: amount (+ or −), kind (starting amount, allowance, purchase, ...), note, and date. Entries are only ever added, never edited.
- Every change does both steps in **one database transaction**: add the entry and change the stored balance by the same amount. Either both happen or neither does.
- **No debt** is enforced by the database itself: a balance can never be below zero, and a payment only goes through if the balance covers it, even when two happen at the same moment.
- When coins move between two people, there are two linked entries (−3000 for the buyer, +3000 for the seller).

Recorded early for the shop: whoever posts a product chooses whether its price **goes to them** (two linked entries) or **vanishes** (only the buyer's entry).

## Why
A currency needs history: people should see exactly why they have the balance they have, and mistakes must be traceable. Adding an entry and reading a balance are both O(1). Adding up the whole ledger, which is O(n), is only done to double-check, in tests or occasionally.

## Alternatives considered
- A balance number only: O(1) everywhere, but no history, so mistakes can't be found or fixed.
- A ledger only: full history, but reading a balance is O(n), and preventing debt when two payments happen at once needs extra locking.
