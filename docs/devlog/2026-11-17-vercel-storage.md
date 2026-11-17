# 2026-11-17: Vercel storage

- Vercel emailed that we used 75% of the free plan's Function Storage (10 GB). That isn't how much the app is used: Vercel keeps a full copy of the backend for every push, and we've pushed a lot while building the poker screens. Past the limit, Vercel deletes the oldest copies by itself; the one in use is never touched.
- Decided two things (decision 0018 updated):
  - In the Vercel project settings, Deployment Retention deletes preview copies after 2 weeks and keeps production ones longer.
  - A push that changes nothing under `backend/` (only the app or the docs) no longer builds the backend. Most of our pushes are app-only, so this saves most copies and makes pushes faster.
- The AI part planned for the court (decision 0024) hardly adds to this: the AI runs on its provider's servers, and its library adds only a few MB per copy.
