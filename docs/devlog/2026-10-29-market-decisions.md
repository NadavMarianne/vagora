# 2026-10-29: Market decisions

- Merged PR #9. The backend side of login is done.
- Joining and leaving (decision 0015): invites by username; leaving freezes your coins, and you can rejoin yourself within 30 days; empty markets are archived and deleted after 30 days.
- Coins (decision 0016): a ledger table plus a stored balance on each membership. Discussed the O(1) and O(n) costs and chose the option that's O(1) for both adding and reading, with history. The database itself prevents debt.
- Allowance (decision 0017): daily, weekly, or monthly with several times or dates, a time zone per market, and delivery by catching up instead of a timer.
- For the shop: whoever posts a product chooses whether its price goes to them or vanishes.
- Started `docs/ideas.md` for future ideas.
- Decided on whole coins only (added to decision 0016).
- Built markets, memberships, and the ledger: create a market, list your markets, change settings, and see your recent transactions. The starting amount is the first ledger entry.
- Tested the "no debt" rule with a real race: two payments of 80 from a balance of 100 at the same moment. One went through, one was refused, and the balance matched the ledger.
- Next: invites by username.
