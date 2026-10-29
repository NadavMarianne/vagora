# 2026-10-29: Database foundation

- Created the Firebase project `vagora-dev` with email/password and Google sign-in, and set its public name to "vagora (dev)".
- Chose the Firebase Admin SDK for checking login tokens (to be recorded with the login code).
- Designed accounts: separate sign-up and log-in, a profile setup screen after the first log-in, unique usernames, free display names, and password rules (decision 0013).
- Chose sync database code (added to decision 0009).
- Connected the backend to PostgreSQL with SQLAlchemy and set up Alembic migrations. CI now runs the tests against a real PostgreSQL and checks that migrations match the tables.
- Next: check Firebase tokens in the backend, then user accounts and profile setup.
