# 0022: The limits file

**Date:** 2026-11-02 **Status:** Accepted

## Decision
Every member has a **limits file** in each market: a list of things that are **never allowed** for them. Punishments (decision 0024) must stay inside it.

- **Filled in when joining.** Members who were already in a market fill it in the next time they open it.
- **A list of short items.** It has no intensity levels. How harsh a punishment is comes from its severity level.
- **Everyone in the market can see it,** as part of each member's page.
- **Removing** an item is always free.
- **Adding** an item costs a fixed amount of the market's currency, and those coins vanish. The price is a market setting, **0 by default**. The first addition after joining is free.
- **Changes apply to the future only.** A punishment that was already given isn't affected, so nobody can dodge one by editing the file.
- The bot, the judge, and the punisher (decision 0024) check everything against it. None of them can go beyond it.

## Why
Control is given up **in advance**, never taken away in the moment. The limits file is where each person says no ahead of time. Removing is free so saying no is never blocked. Adding costs something so the file can't be grown to escape a punishment that's coming.

## Alternatives considered
- A separate list of fears alongside the limits: dropped. One list is clearer.
- Limits with intensity levels: the severity level already handles intensity.
- Limits only the person and the judge can see: everyone seeing them avoids asking for things that are off limits.
