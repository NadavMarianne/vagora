# 0011: Firebase Auth as the login service

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Use Firebase Auth (by Google) for login. The app signs in through Firebase and gets a token. The backend checks that token and links it to the person's vagora account in our own PostgreSQL database. Market data never lives in Firebase.

## Why
- It never pauses: login keeps working even after weeks without use. This is a hard requirement.
- The free plan is enough for vagora for a long time.
- Very mature and strong on phones (Android and iPhone), with Google, Apple, and email sign-in.

## Alternatives considered
- Supabase Auth: fits PostgreSQL and could also host the database, but free projects pause after about a week unused and need a manual restore. The paid plan (about $25 a month) removes pausing, but it is too early to pay.
- Supabase free with a keep-awake trick: a workaround, not a guarantee.
- Auth0: powerful, but complicated and expensive past the free tier.
- Clerk: easiest setup, but weaker for phone apps.

## Trade-off
Firebase is closed source, so moving away later takes some work. Keeping all market data in our own database limits that work to the login part.
