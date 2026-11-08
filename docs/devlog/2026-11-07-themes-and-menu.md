# 2026-11-07: Themes and the menu

- Merged PR #37 (limits files).
- Decided the first release comes before the court, as a birthday gift in a month. Development stays in Expo Go; the release is an Android APK (no store yet), and production gets its own setup that only updates when I release.
- Looked at a page of seven style mockups and decided to keep all seven as looks each person picks: Night (default), Clean, Warm, Velvet, Neon, Paper and ink, Bold pop (decision 0027).
- Rebuilt every screen to draw itself from the picked look: colors, fonts, shapes, shadows. Added the fonts.
- Added a ☰ menu next to the bell, with the market's members, invites, settings, and leaving, plus my markets, notifications, settings, and log out. The market page now shows just the balance, Store, Orders, and transactions.
- First UI fixes: the menu no longer changes after opening (it loads my markets ahead of time). New order: Home at the top, then my markets with "Create a market" set apart, then the market's own items; Settings and Log out pinned to the bottom; Notifications left out (the bell is enough).
- A market's page shows the 5 newest transactions, with "Show more".
- Next: the bell drawing and what the home page should show.
