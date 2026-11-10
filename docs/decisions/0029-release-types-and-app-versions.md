# 0029: Release types and keeping app versions working

**Date:** 2026-11-10 **Status:** Accepted

## Decision
- **Three kinds of release:**
  - **Over the air:** only the app's JavaScript changed (files under `frontend/src/`). Sent with `eas update`, and the phones get it by themselves.
  - **New APK:** something native changed (a native package or an Expo package version in `package.json`, or the name, icon, splash, ID, permissions or plugins in `app.json`). `version` in `app.json` goes up and a new APK is built and installed.
  - **Backend only:** production updates by itself when `release` is merged. Nothing to do on the phones.
- **The tag shows the kind:** a new APK raises the middle number (`v1.1.0`) and matches `version` in `app.json`. Over-the-air and backend-only releases raise the last number (`v1.0.1`). A tag ending in `.0` means "install the new APK".
- **Release notes start with one line:** `Update: over the air. Close and reopen the app.`, `Update: new APK. Install from <link>.`, or `Update: backend only. Nothing to do on the phones.` Then the changes and the issues they closed.
- **Every pull request says which kind it needs** (a checkbox in the PR template).
- **Updates are forced:** when the app opens, and whenever it comes back from the background, it checks for an over-the-air update. If there is one, it shows "Updating Vagora…" and reloads into it right away. With no internet, or a very slow connection, it carries on as it is and tries again next time. (Built in its own pull request.)
- **A minimum app version:** the app sends its version number with every request. The backend answers "too old" to versions below `MIN_APP_VERSION` (a Vercel setting, 0 by default), and the app shows a "Please update" screen that updates it in one tap, or links to the new APK if one is needed. (Built in its own pull request.)
- **A habit:** backend changes keep older app versions working when that's easy (add things, don't rename or remove what the app uses). The minimum version is raised only when a change can't do that.

## Why
During an over-the-air release, phones that are open keep the old version until they restart, and the backend changes for everyone at once. So for a while some people are on an older app. Forcing updates on opening and on coming back keeps that window very short, and the minimum version makes sure an old app never runs against a backend it doesn't fit: it asks to update instead of breaking.

## Alternatives considered
- **Only the habit, no minimum version:** simpler, but nothing stops an old app from breaking if the habit is missed.
- **Expo's automatic "fingerprint" for native changes:** it detects native changes by itself, but adds steps to every build. Worth it if releases become frequent.
- **The default update timing (download on one open, use it on the next):** no code, but people need two opens to catch up, and an app left in the background stays old.
- **Checking only on opening, with a time limit:** gentler, but on Android people mostly switch back to apps rather than open them, so many would stay on the old version.
