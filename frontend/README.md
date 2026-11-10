# vagora app

The phone app (Android and iPhone, plus a web version), built with Expo and TypeScript. See decision 0019.

## Run it on your phone
1. Install **Expo Go** on your phone (Google Play or App Store).
2. On your computer, in this folder: `npm install` (first time only), then `npx expo start`.
3. Scan the QR code: with Expo Go on Android, or with the Camera app on iPhone. Phone and computer must be on the same Wi-Fi.

Code changes appear on the phone within seconds.

By default the app uses the online backend (https://vagora-three.vercel.app). To use a backend running on your computer instead, start Expo with `EXPO_PUBLIC_API_URL` set to its address.

Expo Go always uses development (`vagora-dev`). Only the production APK uses the real setup (decision 0028).

## Releasing (the production APK)
The Expo project is `@vagora-team/vagora`. Log in once with `npx.cmd eas-cli login`.
- **A new APK** (first install, or after native changes like a new native package or the icon): `npx.cmd eas-cli build --platform android --profile production`. It builds in Expo's cloud and gives a download link.
- **An update to installed APKs** (JavaScript and screen changes only): `npx.cmd eas-cli update --channel production --message "what changed"`. Phones get it the next time the app opens and restarts.

Release the backend first (merge `main` into `release`), then the app. Then mark the version: a GitHub Release with a tag on the release commit, `v1.1.0` for a new APK (the same number as `version` in `app.json`) or `v1.0.1` for an over-the-air or backend-only release. The notes start with the kind of update (decision 0029).

## Checks
- `npx expo lint`: code style
- `npx tsc --noEmit`: types

Install packages with `npx expo install <package>`, so their versions match the Expo version.

## Where things are
- `src/app/`: screens. Each file is a screen; `_layout.tsx` decides which screens someone can see.
- `src/lib/`: login (Firebase), talking to the backend, and who is logged in.
- `src/components/`: shared building blocks.
- `src/config.ts`: the backend address and the Firebase project (not secret).
