# 0031: When libraries are updated

**Date:** 2026-11-25 **Status:** Accepted

## Decision
- **App libraries wait for the next planned new APK.** Updating an Expo or other app library needs a new APK that everyone installs by hand (decision 0029), and small fixes come out every week or two. So they're collected: before each planned new APK, run `npx expo install --check` and update everything in one pull request, then test the whole app.
- **Exceptions, updated right away:** a security problem, or a bug we actually hit.
- **New Expo SDKs** (a few times a year) are a planned piece of work of their own, with their own testing, not a quick update.
- **Backend libraries and GitHub workflow tools** don't touch the phones, so they keep coming from Dependabot every week, now as one pull request per week for each instead of one per library. Merge it when CI is green.

## Why
Each new APK means an install on every phone. Batching gives one install with many fixes, and leaves time to test. It's how most apps work: the app's own code updates any day, libraries ride along with the next app release.

## Alternatives considered
- **Update every library as soon as it's out:** newest fixes, but a new APK every few days.
- **Never update until something breaks:** least work, but updates pile up and the eventual jump is big and risky.
