# 0013: Accounts and profiles

**Date:** 2026-10-29 **Status:** Accepted

## Decision
- **Separate sign-up and log-in.** Sign-up asks only for an email and a password. Log-in offers email and password, or Google. Firebase never creates an account from a log-in attempt.
- **Profile setup after the first log-in.** Whether someone signed up by email or used Google for the first time, the app then shows a profile setup screen. Their vagora account exists only once they save it.
- **Username:** unique across vagora, chosen by the person, used for finding others (like Steam). 3 to 20 letters, numbers, or underscores. Not case-sensitive: stored in lowercase, so `Nadav` and `nadav` are the same name.
- **Changing a username:** set once at profile setup for now. Changing it, limited to about once every 30 days, may come later.
- **Display name:** chosen by the person, does not have to be unique, and is shown wherever possible instead of the username. 1 to 30 characters of anything (spaces, emojis, Hebrew), with extra spaces at the ends removed.
- **More profile fields later** (for example gender, age, hobbies), added without changing how log-in works.
- **Password rules:** at least 8 characters, with at least one number, one capital letter, and one special character. Set in Firebase (password policy, enforcement on).
- **Log in with email for now.** The username is for finding people. Logging in with a username may come later through the backend: the app sends the username and password to our server, which looks up the email and asks Firebase, so emails stay private.

## Why
Creating accounts automatically on log-in could let someone make a new account by mistake, with a password they didn't mean to set. Keeping Firebase for "who are you?" and our database for "who are you in vagora?" means profile fields can grow freely.

## Username log-in options considered
- The app looks up the email for a username, then logs in: rejected, because anyone could find out anyone's email.
- The backend logs in for the person: keeps emails private, but passwords pass through our server, so it needs protection against password guessing. Possible later step.
