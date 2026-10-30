# 0019: The app is built with Expo

**Date:** 2026-10-30 **Status:** Accepted

## Decision
The app is built with **Expo** (React Native) in **TypeScript**, in the `frontend/` folder of this repo. One codebase gives an Android app, an iPhone app, and a web version.

- While building, we try it with **Expo Go** on our phones: scan a QR code and it runs, no app store needed.
- Login uses Firebase's standard JavaScript library (email and password for now).
- Screens use Expo Router: each screen is a file in `frontend/src/app/`, and protected routes decide which screens someone can see (logged out, email not verified, no profile yet, ready).
- The app sends a warm-up request to `/health` as soon as it opens (decision 0018).

## Why
It matches the vision (real apps for Android and iPhone, app stores later) without a rebuild later. Expo Go lets both of us try every change on our own phones within seconds, including on an iPhone without a Mac. TypeScript is the most widely used language for apps.

## Alternatives considered
- **A web app** (React on Vercel): fastest to start, but not in the app stores, weaker on phones, and it would need rebuilding later as a real app.
- **Flutter** (Dart): polished and identical on every phone, with excellent Firebase support, but no Expo Go equivalent (every iPhone install needs a Mac and expires after 7 days without a paid Apple account), and Dart is used almost only for Flutter.

## Costs and limits to know
- Google sign-in needs a "development build" instead of Expo Go. On Android that's free. On iPhone it needs either the Mac (free, reinstall every 7 days) or Apple's Developer Program ($99 a year).
- Publishing to the stores later: Apple $99 a year, Google Play $25 once. Expo builds the store apps in the cloud (free plan: about 15 builds per platform a month).
- The "native look" is only a starting point. Every screen can be styled freely.
