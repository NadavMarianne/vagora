# 2026-10-29: Database foundation

- Created the Firebase project `vagora-dev` with email/password and Google sign-in, and set its public name to "vagora (dev)".
- Chose the Firebase Admin SDK for checking login tokens (to be recorded with the login code).
- Designed accounts: separate sign-up and log-in, a profile setup screen after the first log-in, unique usernames, free display names, and password rules (decision 0013).
- Chose sync database code (added to decision 0009).
- Connected the backend to PostgreSQL with SQLAlchemy and set up Alembic migrations. CI now runs the tests against a real PostgreSQL and checks that migrations match the tables.
- Merged PR #6. Set the password rules in Firebase.
- Decided to log in with email for now; username log-in through the backend may come later (decision 0013).
- Discussed moving into the dev container. Staying on Windows for now, with Claude running tests in Docker. Added how we work together to CLAUDE.md so any future session follows it.
- Decided to require a verified email before using vagora.
- Added Firebase token checking to the backend (decision 0014). Found that the Firebase library looks for a secret key on startup even though checking tokens doesn't need one, and fixed it so no key is used at all. Tested against the real `vagora-dev` project: fake tokens are rejected.
- Next: user accounts and profile setup.
