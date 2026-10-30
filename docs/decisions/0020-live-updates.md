# 0020: Live updates through Firestore

**Date:** 2026-10-30 **Status:** Accepted

## Decision
When something changes for someone (an invite for them, a new member, a payout, changed settings), their open app updates at once, and a banner pops up for news like "Dana invited you to Home".

- The backend writes one small note per person in **Firestore** (Firebase's live database): `signals/{firebase uid}`, saying *that* something changed and, sometimes, a message. All real data stays in PostgreSQL.
- The app listens to the logged-in person's note. A change reloads the screen on display (others reload when shown), and a message shows as a banner that opens the right place when tapped.
- **Security rules** (`firestore.rules`): each person can read only their own note, and nobody but the backend can write.
- The backend writes with a **dedicated key** that can only use Firestore ("Cloud Datastore User" role on the `vagora-signals` service account), stored only in Vercel as `FIREBASE_SERVICE_ACCOUNT`. Never in Git.
- Notes are best effort: if one fails, the action still succeeds, and screens catch up when next opened. Without the key (tests, local development), live updates are simply off.
- Development Firestore is in Frankfurt (europe-west3), next to the backend and database. Production gets its own Firebase project, likely in the US.

## Why
Faster polling (like every second) drains phone batteries, multiplies requests as vagora grows, and still isn't instant. A live connection is instant and only sends something when there's news. Vercel can't hold live connections open, and Firestore is part of Firebase, which vagora already uses. Its free plan (50,000 reads and 20,000 writes a day) is far more than needed.

## Alternatives considered
- **Polling every 15, 3, or 1 seconds:** simple, but delayed, and costly at short intervals.
- **Pull to refresh:** manual only.
- **Push notifications:** reach a closed app, but need development builds and a scheduled job. Still planned for later.
- **Firebase's default admin key:** one click, but a leak would expose the whole Firebase project, including user accounts.
