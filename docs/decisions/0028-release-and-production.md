# 0028: Release and the production setup

**Date:** 2026-11-10 **Status:** Accepted

## Decision
- **First release:** an Android APK, built in Expo's cloud (EAS Build, free) and installed directly, with no app store yet. Development stays in Expo Go.
- **App identity:** the name "Vagora", the ID `com.vagora.app` (to be confirmed once a domain is chosen, before any store release), and the "deep night" icon.
- **A separate production setup**, so testing never touches real data:
  - Firebase `vagora-prod`: email and password login, Firestore in `europe-west3` (Frankfurt), the same rules as development, and its own `vagora-signals` key (Cloud Datastore User only).
  - Neon project `vagora-prod`: Postgres 18, Frankfurt, database `vagora`. The development project is renamed `vagora-dev`.
  - Vercel project `vagora-api-prod`, at `https://vagora-api-prod.vercel.app`: root `backend`, region `fra1`, and the three settings (`DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`) set for Production only. It builds only production deployments.
- **Releasing:** production follows a `release` branch. A release is a pull request that merges `main` into `release`. Merging to `main` changes development only.
- **Version tags:** each release gets a GitHub Release with a tag (`v1.0.0`, `v1.1.0`, ...) on its merge commit in `release`, with short notes. The `release` branch moves with every release, and the tag stays on that exact code forever. The number matches `version` in `app.json`.
- **Merging:** pull requests into `main` use "Squash and merge" (the only option there). Release pull requests use "Create a merge commit" (the only option on `release`), so `release` holds the exact commits of `main` and each release shows only what's new. `release` is protected like `main`: no deleting, no force pushes, changes through a pull request with the CI check passing.
- **App updates over the air** (`expo-updates`): JavaScript changes reach the installed APK without a new install. Native changes (new native packages, icon, app ID) need a new APK. The runtime version follows the app version, so an update only goes to APKs it fits.
- **The app picks its setup from its update channel.** The production APK is built on the `production` channel (`eas.json`), so it talks to the production backend and Firebase, including after every update. Expo Go has no channel, so it uses development.

## Why
A separate Firebase, Neon and Vercel project means separate passwords, separate free allowances, and no way for a test or a reset to reach the real data. A `release` branch lets `main` keep moving while the real app changes only when we choose. Reading the channel instead of a build setting means an update can't send the real app to the development servers by mistake.

## Alternatives considered
- **Version tags on `main`** (the earlier plan in decision 0012): fine for marking versions, but Vercel deploys from a branch, so a branch is simpler.
- **A production branch inside the development Neon project:** shares passwords and free limits with testing.
- **Firestore in Tel Aviv, the US or several regions:** the backend and database are in Frankfurt, so a different Firestore region adds distance without real gain. The live-update notes are throwaway, so moving them later is easy.
- **Neon's realtime:** live updates already work through Firestore, and it would mean phones connecting to the database directly.
- **A Play Store release now:** needs a developer account, a privacy policy and a review. Later.
