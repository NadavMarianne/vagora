# vagora app

The phone app (Android and iPhone, plus a web version), built with Expo and TypeScript. See decision 0019.

## Run it on your phone
1. Install **Expo Go** on your phone (Google Play or App Store).
2. On your computer, in this folder: `npm install` (first time only), then `npx expo start`.
3. Scan the QR code: with Expo Go on Android, or with the Camera app on iPhone. Phone and computer must be on the same Wi-Fi.

Code changes appear on the phone within seconds.

By default the app uses the online backend (https://vagora-three.vercel.app). To use a backend running on your computer instead, start Expo with `EXPO_PUBLIC_API_URL` set to its address.

## Checks
- `npx expo lint`: code style
- `npx tsc --noEmit`: types

Install packages with `npx expo install <package>`, so their versions match the Expo version.

## Where things are
- `src/app/`: screens. Each file is a screen; `_layout.tsx` decides which screens someone can see.
- `src/lib/`: login (Firebase), talking to the backend, and who is logged in.
- `src/components/`: shared building blocks.
- `src/config.ts`: the backend address and the Firebase project (not secret).
