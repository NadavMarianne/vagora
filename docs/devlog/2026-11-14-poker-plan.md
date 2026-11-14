# 2026-11-14: Planning poker tables

- Moved development and CI to Postgres 18, the same as production (#54).
- Planned the first game: a poker table for real cards, where the app is the chips and does the bookkeeping. No-Limit Texas Hold'em, 2 to 9 players, blinds and buy-ins per table, an optional turn timer, side pots, and a showdown everyone in the hand agrees on (decision 0030).
- Only the market's currency is played for. Betting store items might come later.
- Next: tables and seats (buy-in, top-up, leaving), then the hand engine with thorough tests, then the app screens.
- Built poker tables and seats: opening a table with its settings, sitting down with a buy-in, topping up to the maximum, leaving with the whole stack, closing an empty table. Leaving a market gets you up from its tables. The tests check after each step that every coin is accounted for.
- Built the hand engine: the poker rules on their own (blinds, turns, minimum raises, short all-ins, side pots, splits), and saving hands with the turn timer and the showdown agreement. A test plays thousands of random hands and checks no chip is ever lost or made.
- Built the poker screens: Games in the menu and on the market page, opening a table, and the table itself (seats and stacks, dealer prompts, your turn with a two-tap fold and raise shortcuts, the showdown agreement, sitting down, topping up and getting up).
- First test game on two phones. When a turn ran out, the other phone didn't show it was their turn: the server applied the timer but told nobody, and a phone whose clock runs a little ahead asked too early and never again. Now a run-out turn tells everyone, and the app tries again a few times after a deadline.
- From the test: sliders for the buy-in, topping up, and the new partial cash-out. Colored actions (fold red, check green, call blue, raise gold). Raising opens a slider with ¼, ⅓ and ½ pot and pot shortcuts, and an all-in button at its end that shines when picked.
