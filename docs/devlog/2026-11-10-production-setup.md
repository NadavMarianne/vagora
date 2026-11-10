# 2026-11-10: The production setup

- Decided how the first release works: an Android APK built in Expo's cloud, a separate production setup, and a `release` branch that production follows (decision 0028).
- Set up Firebase `vagora-prod`: email and password login with a strong password policy, Firestore in Frankfurt with the same rules as development, a web app config, and a `vagora-signals` key that can only use Firestore.
- Created the Neon project `vagora-prod` (Postgres 18, Frankfurt, database `vagora`) and renamed the old one to `vagora-dev`. Kept them separate so passwords and free limits aren't shared with testing.
- Created the Vercel project `vagora-api-prod`, which builds only from `release`. The key and the database address live only there. The first deploy created all the tables, and `/health` answers "ok".
- The app now picks its setup from its update channel: the production APK talks to production, Expo Go to development. Added `expo-updates` so small fixes reach the installed app without a new install, and linked the app to the Expo organization `vagora-team`.
- Next: build the first APK and install it on both phones.
- Protected the `release` branch like `main`. Release pull requests use "Create a merge commit" and everything else "Squash and merge", so `release` keeps the same commits as `main` and doesn't drift apart.
