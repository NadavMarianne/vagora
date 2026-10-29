# 0014: Checking login tokens

**Date:** 2026-10-29 **Status:** Accepted

## Decision
- The backend checks Firebase login tokens with the official Firebase Admin SDK.
- It uses only the Firebase project ID (`FIREBASE_PROJECT_ID`, default `vagora-dev`). No secret key file is used, so none can leak into Git.
- Endpoints that need a logged-in person use the `get_firebase_user` dependency in `app/auth.py`.
- **A verified email is required.** Email sign-ups must click the confirmation link before using vagora. Google accounts are already verified.

Responses:

| Situation | Answer |
|---|---|
| No token | 401 Not logged in |
| Invalid or expired token | 401 Login is invalid or expired |
| Email not verified | 403 Please verify your email first |
| Firebase's certificates can't be fetched | 503 Try again soon |

## Why
The official SDK handles the security details (signature, expiry, which project the token is for), which are easy to get subtly wrong by hand. Requiring a verified email stops mistyped or borrowed emails and makes sure password reset reaches the real person.

## Alternatives considered
- Checking tokens ourselves with `google-auth` or `PyJWT`: lighter, but we would write the checking rules ourselves and could miss one.
- Not requiring a verified email: faster start, but a typo in an email could lock someone out for good, and accounts could be made with other people's emails.

## Known limit
A disabled Firebase account keeps working until its current token expires (up to one hour). Checking for that on every request would need a secret key, so it waits until it is really needed.
