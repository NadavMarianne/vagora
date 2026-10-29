# 0010: Use a login service

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Real login comes before the market features, and it is handled by an outside login service, not built by us. The app logs in through the service and receives a token, and the backend checks that token on every request. Which service is decided separately.

## Why
Login done right is a lot of work (safe password storage, tokens, password reset emails, attack protection, Google and Apple sign-in), and mistakes there make a product unsafe. Most businesses use a login service for this reason. It is not what makes vagora interesting, so we don't build it ourselves.

## Alternatives considered
- Our own login (possibly with a library like fastapi-users): full control and no outside dependency, but much more work and all the security responsibility stays with us.
- Names only for now: fastest, but not safe for anything online. Rejected in favor of real login first.
