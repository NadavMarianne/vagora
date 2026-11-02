# 2026-11-02: Product owners

- Tested buying and orders on the phone: it works. Merged PRs #31, #32, #33.
- Found PR #33's test copy failed to build: all PRs share one test database, and #32 had already moved it ahead. Nothing was broken. A separate test database per PR would fix it for good.
- Owners can now sell their own product later ("Sell it myself"), not only when creating it.
- Decided a product can have several owners. Changing its name or description, closing it, and adding or removing owners need every owner's approval; the person asking picks how long the others have to answer. Asking new sellers doesn't. An owner can step down, and if the last owner leaves, the sellers can claim it. Recorded in decision 0021.
- Next: try it on the phones, then step 3 (missed deadlines).
