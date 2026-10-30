# 2026-10-30: Store decisions

- Merged PR #28. The first app is done: login, markets, invites, live updates, all tested on both phones.
- Wrote the store spec: products, offers made through proposals, buying with held coins, orders, refunds, disputes, reports. Went through every open question.
- Decided the coin mode (pays the seller or vanishes) is chosen per product by its creator.
- Decided sellers can commit to an offer by time, by stock, or both (released when the first runs out, or when both do).
- Added a refund percentage on refundable offers. A cancellation caused by the seller always refunds 100%.
- Dropped the missed-deadline count. Missed deadlines file an automatic report instead. What a report does (trial, judges, penalties by severity) is left open.
- Decided nobody can leave a market while they have committed offers or open orders as a seller. This closes the question left open in decision 0015.
- Recorded it all as decision 0021, and moved the "later" items to the ideas list.
- Next: build the store in four steps, starting with products, proposals, and offers.
