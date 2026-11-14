# 2026-11-14: Planning poker tables

- Moved development and CI to Postgres 18, the same as production (#54).
- Planned the first game: a poker table for real cards, where the app is the chips and does the bookkeeping. No-Limit Texas Hold'em, 2 to 9 players, blinds and buy-ins per table, an optional turn timer, side pots, and a showdown everyone in the hand agrees on (decision 0030).
- Only the market's currency is played for. Betting store items might come later.
- Next: tables and seats (buy-in, top-up, leaving), then the hand engine with thorough tests, then the app screens.
