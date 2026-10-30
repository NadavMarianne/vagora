# 0018: Hosting on Neon and Vercel

**Date:** 2026-10-30 **Status:** Accepted (for now)

## Decision
- **Database: Neon** (free), region Frankfurt. Real PostgreSQL. It sleeps after 5 minutes unused and wakes by itself in a fraction of a second. Branches it archives after a while also come back by themselves on the next connection.
- **Backend: Vercel** (free Hobby plan), region Frankfurt (`fra1`), as its own Vercel project with `backend/` as its root folder. Every merge to `main` goes live, and every pull request gets its own preview link.
- **Separate databases per Vercel environment:** Production uses Neon's main branch, pull request previews use a permanent Neon `preview` branch. Both are still the development stage (with Firebase `vagora-dev`). Real production gets its own Neon project, Firebase project, and Vercel setup when vagora goes live (decision 0012).
- **Preview links are open** (Vercel's Deployment Protection is off, 2026-10-31), so the phones can test a pull request before it's merged: start Expo with `EXPO_PUBLIC_API_URL` set to the pull request's preview link. Everything except `/health` still needs a Firebase login. Turn protection back on before going live.
- **Migrations run on every deploy,** as Vercel's build step (`[tool.vercel.scripts]` in `pyproject.toml`), before the new version goes live. A failed migration is undone by PostgreSQL and stops the deploy, so the old version keeps running.
- **The app sends a warm-up request** (to `/health`) as soon as it opens, so the backend is awake by the time login finishes.
- A web frontend can later be a second, separate Vercel project from the same repo.

Both meet the hosting rule from decision 0007: the app keeps working after weeks without use, with no manual wake-up.

## Why
The priority is seeing everything work end to end, soon. Vercel is the fastest to set up, needs no card, wakes in about 1 to 2 seconds, and its preview links fit our pull request workflow. vagora isn't commercial yet, so the Hobby plan's non-commercial rule doesn't apply.

## Alternatives considered
- **Google Cloud Run:** $0, a standard container, no commercial limit, 1 to 5 second wake-up. Needs a card and more setup. The best place to move to later.
- **Fly.io always on:** about $2 a month, never sleeps. Within budget (up to $5 a month).
- **Render free:** about a one-minute wake-up after 15 minutes unused, which would hit almost every time the app is opened.
- **Railway:** $5 a month flat, right at the budget limit.
- **Koyeb:** unclear free terms during its acquisition.
- **Supabase free database:** pauses after a week unused and needs a manual restore.

Migrations through GitHub Actions instead: works with any host, but runs side by side with Vercel's deploy (code could go live before its tables), and the database addresses would be stored in GitHub too.

## When to revisit
If vagora becomes commercial (Vercel's Hobby plan forbids that; Pro is $20 a month), or if the wake-up time bothers us. Moving the backend to Cloud Run or Fly.io needs no app code changes, only a container recipe and a deploy workflow.
