# 0015: Joining and leaving markets

**Date:** 2026-10-29 **Status:** Accepted

## Joining
- The person who creates a market is its first member.
- Any member can invite someone **by username**. The invited person accepts or declines. Nobody is added without agreeing.
- The invited person sees who sent the invite. The market's list of open invites shows only who is invited.
- Who invited each member is saved, for a future market chat ("Noa joined from Dana's invite").
- **The inviter sets when the invite expires:** 1 hour to 30 days, 7 days if not chosen.
- Any member can cancel an invite that hasn't been answered.
- Inviting someone who is already a member, or already has a pending invite, is refused.
- Someone who declined can be invited again, with no limit. Blocking markets or people is a future idea.
- New members get the market's starting amount when they accept.

## Leaving
- Anyone can leave a market. Nobody can remove someone else (that waits for admin roles).
- **Coins are frozen, not lost.** Within 30 days of leaving, you can rejoin yourself from settings and get your coins back. After 30 days you need a new invite, and your frozen coins come back then too.
- **Coming back never gives the starting amount again**, whether by rejoining or by a new invite. You get your frozen coins. Otherwise leaving and coming back would be a way to collect free coins.
- **Invites you sent are cancelled when you leave.** Otherwise a friend could join with your long invite after you're gone.
- **History is kept.** Other members' ledgers point to your entries, so nothing is deleted.
- **When the last member leaves**, the market is archived (hidden, data kept). If nobody rejoins within 30 days, it is deleted for good.
- Deleting old empty markets runs alongside normal use, at most once a day, so it needs no always-on server. A market is deleted *at least* 30 days after it empties.

## Why
Invites by username use the unique usernames, and need no extra system. Freezing coins and keeping history means leaving by mistake or after a fight costs nothing. Letting anyone remove anyone is open to abuse while all members are equal.

## Alternatives considered
- Invite links or codes: easy to share, but anyone with the link can join. Saved as a future idea.
- Adding members directly: people would end up in markets without agreeing.
- Coins vanishing on leave: harsh and easy to regret.
- A scheduled job (on the server or on GitHub) for deleting old markets: runs on time even when nobody uses vagora, but needs an always-on server or extra setup. Planned for production.

## Unfinished orders
What happens to offers, orders, and disputes when someone leaves is decided in decision 0021 (section 8): you can't leave while you have committed offers or open orders as a seller.
