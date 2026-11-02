# 0025: Extras: mystery orders, auctions, bounties, streaks

**Date:** 2026-11-02 **Status:** Accepted (built last, after orders, the limits file, and the court)

Items marked **Open** aren't decided yet.

## 1. Mystery orders
- A special offer with a fixed price. The seller writes a **pool of outcomes** in advance. Each is a normal, agreed item that fits the limits file.
- The buyer sees the price and how many outcomes there are, not what they are.
- On purchase, one is drawn at random, revealed at a set time, and then runs like any other order.
- The pool is the consent: nothing can be drawn that the seller didn't put in.
- **Open:** rarity weights, and whether the seller sees the draw before the reveal.

## 2. Sealed-bid auctions
- A limited item (for example "once a month") is sold by auction for a set time. Each eligible member places one **secret bid**, and those coins are held.
- When it closes, the highest bid wins (a tie goes to the earlier bid). The winner pays, and the other holds are released. Bids are revealed only after closing.
- The winning coins follow the product's coin mode.
- **Small markets:** with two members a seller has only one bidder, so the item should be a **house item**, created by the market itself with no seller. Everyone can bid, and the coins vanish.
- **Open:** how often house items appear, and who creates them.

## 3. Bounties
- The reverse of a shop: a member posts a **request** with a description, a deadline, and the coins they'll pay, which are held.
- It goes to one member, several, or all. A target accepts or declines. Declining costs nothing. Accepting makes it binding, and it runs as an order with the poster as the buyer.
- Unaccepted bounties expire and the coins return.
- **Open:** whether the accepter sets their own refund policy, and the default expiry.

## 4. Countdowns, streaks, and rewards
- **Countdown:** an order can have a reveal time, with a notification to both sides.
- **Streak:** consecutive orders completed on time, per member.
- **Reward chest:** reaching a streak threshold unlocks one. What it holds is a market setting (bonus coins, a free item from another member, a pass that cancels one punishment).
- **Open:** thresholds, chest contents, and how a missed deadline affects a streak.

## Dropped
Trust levels (limits that can only be raised if both members agree).
