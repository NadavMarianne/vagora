# 0013: Accounts and profiles

**Date:** 2026-10-29 **Status:** Accepted

## Decision
- **Separate sign-up and log-in.** Sign-up asks only for an email and a password. Log-in offers email and password, or Google. Firebase never creates an account from a log-in attempt.
- **Profile setup after the first log-in.** Whether someone signed up by email or used Google for the first time, the app then shows a profile setup screen. Their vagora account exists only once they save it.
- **Username:** unique across vagora, chosen by the person, used for finding others (like Steam).
- **Display name:** chosen by the person, does not have to be unique, and is shown wherever possible instead of the username.
- **More profile fields later** (for example gender, age, hobbies), added without changing how log-in works.
- **Password rules:** at least 8 characters, with at least one number, one capital letter, and one special character. Set in Firebase.

## Why
Creating accounts automatically on log-in could let someone make a new account by mistake, with a password they didn't mean to set. Keeping Firebase for "who are you?" and our database for "who are you in vagora?" means profile fields can grow freely.

## Still open
Whether people can log in with their username instead of their email. Firebase logs in by email only, so this needs extra work.
