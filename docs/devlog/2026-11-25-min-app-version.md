# 2026-11-25: "Please update" for apps that are too old

- Built the last piece of decision 0029. Automatic updates already handle changes to the app's code. What was missing: an app that's too old for the backend and can't be fixed by an automatic update (because the newer version needs a new APK) would just break in odd ways.
- Now the app sends its version number with every request, and the backend answers "too old" when it's below `MIN_APP_VERSION`. The app then shows "Please update": it tries an automatic update first, and if there's none, it offers a download link for the new APK.
- Two new Vercel settings, both empty or 0 by default so nothing changes until they're set: `MIN_APP_VERSION` and `APK_URL`.
- The app already on the phone (v1.0.1) sends no version number. It counts as 0, so it keeps working.
- Only requests through our backend are checked; the live updates from Firestore aren't, which is fine, since the app stops at "Please update" on its first request.
