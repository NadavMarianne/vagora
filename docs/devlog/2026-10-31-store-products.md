# 2026-10-31: Store, step 1 (products, proposals, offers)

- Merged PR #29 with the store decisions (decision 0021).
- Built step 1 of the store: products, proposals, offers, commitments, closing a product, and the leaving rule for offers.
- New tables: products, proposals, offers. Timers (proposal expiry, removal dates, commitments ending) use catch-up like the allowance: the store sorts itself out whenever someone opens it.
- New screens: the store, a new product, a product's page (sellers sorted by price, the creator's tools), answering a proposal with your terms, and changing your offer.
- Added a time picker with a slider, a number box, and a unit, which stay in sync. It needed the slider package (`@react-native-community/slider`).
- Next: try it on both phones, then step 2 (buying and orders).
