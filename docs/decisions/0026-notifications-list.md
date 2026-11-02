# 0026: The notifications list

**Date:** 2026-11-02 **Status:** Accepted

## Decision
Every notification with a message is **saved in the database** for each person it's sent to, in a `notifications` table. The live banner (decision 0020) still pops up at once; the saved copy is what the list shows.

- A **bell** in the top corner of every screen opens the list. A **blue dot** on it means something is unread.
- The list is newest first. Tapping one opens the page it's about and marks it read. Each one can be dismissed. **Mark all as read** and **Dismiss all** are at the top.
- **Opening the app** first catches up all your markets, so anything whose time came while the app was closed (a missed deadline, for example) is sent then. If one new notification is waiting, its banner shows. If more than one, the banner says "You have N new notifications" and opens the list. "New" means newer than the last one this phone already showed.
- Dismissed notifications are deleted. The list shows the newest 100.

## Why
A list that only knew what arrived while the app was open would miss exactly what matters most: what happened while you were away. Kept in the database, the list is the same on every phone you log into, and push notifications (later) can use the same table.

## Alternatives considered
- Saved on the phone only: simpler, but misses everything from while the app was closed, and each phone has its own list.
- Kept only while the app is open: the list empties every time the app closes.
