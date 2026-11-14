# 2026-11-14: Planning poker tables

- Moved development and CI to Postgres 18, the same as production (#54).
- Planned the first game: a poker table for real cards, where the app is the chips and does the bookkeeping. No-Limit Texas Hold'em, 2 to 9 players, blinds and buy-ins per table, an optional turn timer, side pots, and a showdown everyone in the hand agrees on (decision 0030).
- Only the market's currency is played for. Betting store items might come later.
- Next: tables and seats (buy-in, top-up, leaving), then the hand engine with thorough tests, then the app screens.
- Built poker tables and seats: opening a table with its settings, sitting down with a buy-in, topping up to the maximum, leaving with the whole stack, closing an empty table. Leaving a market gets you up from its tables. The tests check after each step that every coin is accounted for.
- Built the hand engine: the poker rules on their own (blinds, turns, minimum raises, short all-ins, side pots, splits), and saving hands with the turn timer and the showdown agreement. A test plays thousands of random hands and checks no chip is ever lost or made.
