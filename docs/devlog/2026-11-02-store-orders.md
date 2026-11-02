# 2026-11-02: Store, step 2 (buying and orders)

- Built buying: the price leaves the buyer's balance at once and is held by the order. Stock and stock commitments count down.
- Built orders: the buyer marks it done, or the seller says "I did it" and it counts as done 3 days later unless the buyer disputes. A dispute holds the coins until it's settled; either side can give up.
- Refunds: refundable orders can be cancelled before the deadline for their refund percentage. Non-refundable ones can be given up, or the buyer can ask the seller for a refund. "On request" orders that are never asked for expire, with the refund percentage back if refundable.
- When an order ends, the held coins go to the seller or vanish, by the product's coin mode.
- Sellers can't leave a market while they have orders to deliver. Buyers can, and refunds wait in their frozen coins.
- The store now catches up whenever a market is opened, not only the store.
- Checked real races: two buyers for the last item, and two actions on one order at once. Exactly one wins each time, and no coins appear or disappear.
- New screens: Buy on each offer, an Orders list (to deliver, bought, past), and an order page with the actions for your side.
- Next: try it on the phones, then step 3 (missed deadlines).
