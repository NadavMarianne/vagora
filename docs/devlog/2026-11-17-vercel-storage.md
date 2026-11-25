# 2026-11-17: Vercel storage

- Vercel emailed that we used 75% of the free plan's Function Storage (10 GB). That isn't how much the app is used: Vercel keeps a full copy of the backend for every push, and we've pushed a lot while building the poker screens. Past the limit, Vercel deletes the oldest copies by itself; the one in use is never touched.
- Decided two things (decision 0018 updated):
  - In the Vercel project settings, Deployment Retention deletes old copies: canceled and failed builds after a week, previews and production after 30 days (the most the free plan allows). The real project keeps its production copies 30 days too. The copy in use is never deleted.
  - A push that changes nothing under `backend/` (only the app or the docs) no longer builds the backend. Most of our pushes are app-only, so this saves most copies and makes pushes faster.
  - First try put this rule in `backend/vercel.json`. Both Vercel builds failed, and a rule in that shared file would also replace the real project's own "build only releases" rule. So it's set in the test project's dashboard instead, under Settings → Build and Deployment → Ignored Build Step.
- The AI part planned for the court (decision 0024) hardly adds to this: the AI runs on its provider's servers, and its library adds only a few MB per copy.
- Learned on the way: all pull request previews share one test database. A branch made before another pull request's database change fails its preview build (`alembic upgrade head` can't find the newer change) until it's updated from `main`.
