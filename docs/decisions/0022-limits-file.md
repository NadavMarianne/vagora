# 0022: The limits file

**Date:** 2026-11-02 **Status:** Accepted

## Decision
Every member has a **limits file** in each market: a list of things that are **never allowed** for them. Punishments (decision 0024) must stay inside it.

- **Filled in when joining.** Creating or joining a market starts with a "Your limits" step, which can be left empty. Members who were already in a market when this was built (2026-11-07) aren't asked; they edit theirs from their member page.
- **A list of short lines,** up to 100 characters each, with no limit on how many. It has no intensity levels. How harsh a punishment is comes from its severity level.
- **Everyone in the market can see it,** on each member's page (tap a member in the market's member list).
- **An edit is paid as a whole** (decided 2026-11-07). Saving the file once is one edit, and in a paid edit you can add, change, and remove as much as you like. The price is a market setting ("Price to edit limits"), **0 by default**, and those coins vanish. No debt: without enough coins, the edit is refused.
- **What's free:** the first setup, the first edit after it, and any edit that **only removes** lines.
- **History is kept:** lines are never deleted, only marked removed, with times. A changed line counts as the old one removed and a new one added, so the court can see the file as it was at any moment.
- **Changes apply to the future only.** A punishment that was already given isn't affected, so nobody can dodge one by editing the file.
- The bot, the judge, and the punisher (decision 0024) check everything against it. None of them can go beyond it.

## Why
Control is given up **in advance**, never taken away in the moment. The limits file is where each person says no ahead of time. Removing is free so saying no is never blocked. Adding costs something so the file can't be grown to escape a punishment that's coming.

## Alternatives considered
- A separate list of fears alongside the limits: dropped. One list is clearer.
- Limits with intensity levels: the severity level already handles intensity.
- Limits only the person and the judge can see: everyone seeing them avoids asking for things that are off limits.
