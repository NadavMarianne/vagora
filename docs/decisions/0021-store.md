# 0021: The store: products, offers, buying, and orders

**Date:** 2026-10-30 **Status:** Accepted

Items marked **Open** aren't decided yet. Items marked **Later** are saved for a future version.

## 1. Products and offers
- **Product:** a name, a description, a status, and a **coin mode**. Any member can create one.
- **Coin mode** is chosen by the product's creator: when an order completes, the coins either **go to the seller** or **vanish**. Different products in the same market can use different modes.
- **Offer:** one per seller of a product. It holds the price and the seller's settings (below). Every offer starts at the price in its proposal.
- Nobody can buy their own offer.
- **Product status:** *waiting* (no seller has accepted yet), *live* (at least one offer), *closed*.
- The creator can edit the name and description.
- **Closing a product** stops new proposals and removes every offer without a commitment. Committed offers stay until their commitment is released. Closing never removes them. Orders already placed never change.

Each seller sets these on their own offer:
- **Delivery type:**
  - **fixed deadline**, like "within 3 days", where the timer starts at purchase; or
  - **on client's request**, with a validity period that starts at purchase (see section 5).
- **Refund policy:** refundable or non-refundable. A refundable offer has a **refund percentage** (for example 80%).
- **Stock limit** (optional): how many times the offer can be bought. With no limit, it can be bought any number of times, and one buyer can have several open orders.
- **Commitment** (optional, see section 3).
- **Automatic removal date** (optional). It can't be earlier than the end of a time commitment.

Before buying, the buyer sees:
- the delivery type and validity
- the refund policy and percentage
- the stock left
- any commitment badge ("guaranteed until Friday", "guaranteed for 5 more").

## 2. Proposals
- The creator picks the sellers: one, several, or all current members. The creator can pick themselves; that proposal is accepted at once.
- Each seller gets a proposal with the price. The first round uses one price for everyone. A seller can only **accept** or **decline**. Accepting means filling in the offer's settings.
- The product goes live as soon as one seller accepts. A seller who declines is simply not a seller.
- If a seller declines, the creator can edit the price for that seller and send a new proposal.
- The creator can send proposals to more members at any time while the product isn't closed.
- **Proposal expiry:** the creator sets it per product, from 5 minutes to 30 days, with a slider and a number box that stay in sync. Default: 3 days.
- Accepting a proposal is the agreement: a seller can't refuse an order placed on their offer.
- **Later:** counter proposals.

## 3. Changing and removing offers
- **No commitment:** the seller can change anything (including raising the price above the proposal) or remove the offer at any time.
- **Commitment:** chosen when accepting the proposal. The seller picks one of:
  - **time:** guaranteed until a date
  - **stock:** guaranteed for the next N purchases
  - **both, released when the first runs out:** whichever comes first, the date or the N purchases
  - **both, released when both run out:** the date has passed *and* N purchases were made
- While committed, the seller:
  - can't remove or edit the offer;
  - can lower the price and raise it back, never above the committed price;
  - can extend the commitment, never shorten it.
- An automatic removal date never removes a committed offer before its commitment is released.
- **Orders already placed never change** when an offer is edited, removed, or expires. They keep the price paid and the settings they were bought with.

## 4. Buying
1. The buyer opens a product and sees its sellers, sortable by price (reviews later).
2. The buyer picks a seller and taps Buy. No debt: the buyer needs enough coins.
3. The coins leave the buyer's balance **at once** and are held.
4. The order goes straight to that seller.
5. When the order completes, the held coins go to the seller or vanish (the product's coin mode). When it's cancelled, they go back to the buyer (fully or partly, see section 6).

## 5. Order lifecycle
**Fixed deadline:** the timer starts at purchase.

**On client's request:** the buyer asks for the favour in person, then taps **Fulfilled**. If the seller refuses, the buyer taps **Refused**, which counts as a missed deadline. If the validity period ends unused, the order ends. On a refundable offer, the buyer gets the refund percentage back.

**Completing an order:**
- The buyer can tap **Fulfilled** at any time.
- **Refused** exists only for "on client's request" orders. On fixed-deadline orders, the timer running out is what counts as refused.
- The seller can tap **I did it**, and the buyer is asked to confirm. If the buyer doesn't dispute within **3 days**, the order completes on its own.
- If the buyer disputes, a dispute starts (section 7). The coins stay held until it ends.

**Missed deadline.** On a fixed deadline, the timer ran out. On client's request, the buyer tapped Refused. The buyer can then choose, with **no time limit**:
1. **Cancel:** the coins are returned in full, the order is marked "not delivered", and an automatic report is filed against the seller.
2. **Accept late:** wait for the work, or accept work already done, then mark it fulfilled. The seller can still tap I did it.
3. **Propose a new deadline:** if the seller agrees, a new timer starts. If the seller declines, the buyer can propose another one or cancel (as in 1).

While the buyer hasn't chosen, or is accepting late, **the seller can end the order**. That counts as a cancelled order: a full refund to the buyer and an automatic report against the seller. This prevents orders lingering for years.

A missed deadline always lets the buyer cancel with a full refund, even on non-refundable offers.

After any outcome, either side has **3 days** to file a report, and may choose not to.

## 6. Refunds
- **Refundable:** the buyer can cancel before the deadline (or validity) ends, and gets the offer's refund percentage back.
- **Non-refundable:** the buyer can't cancel. They can:
  - **discard** the order: give it up and get no coins back;
  - **ask for a refund:** the seller accepts (the buyer gets the full price back) or declines.
- Coins that aren't refunded follow the product's coin mode: they go to the seller or vanish.
- A cancellation caused by the seller (a missed deadline, or the seller ending the order) always refunds **100%**, whatever the percentage. Otherwise a seller could profit from missing deadlines.

## 7. Disputes and reports
- If the buyer disputes an I did it, the coins stay held. There's no time limit for now (**Open**).
- Either side can give up at any time:
  - **The seller gives up:** the buyer is refunded in full, and can file a more severe report.
  - **The buyer gives up:** the seller is paid, there's no refund, and the seller may file a counter report.
- **Reports, version 1:** a table of reports linked to members. A report records:
  - who filed it, and against whom
  - the order
  - what happened
  - whether it was automatic
  - the written text, and one written reply from the other side
  - a severity
  - whether the accused person had left the market when it was filed, or when they gave up
- A report doesn't do anything yet. Later it puts the person "on trial" and decides a penalty, if any.

## 8. Leaving a market (completes decision 0015)
- **You can't leave** while you have committed offers, or open orders as a seller. No exploits.
- When you leave:
  - your offers without a commitment are removed;
  - your waiting proposals are declined.
- **Your orders as a buyer** keep going on their own:
  - refunds from expired orders go to your frozen coins;
  - a seller's I did it completes after 3 days as usual.
- **Disputes** you have open are lost: the other side wins, and can still file a report.
- **A report against you in progress** counts as giving up. It's saved as "left during report", for more severe treatment when you return.
- **A report filed after you left** is saved the same way. If it turns out unjustified, nothing happens. If you're found guilty, it counts as more severe when you return.

## Open
- What a report is and does: the trial, who judges, the penalties.
- A time limit on disputes.

## Later
- Counter proposals.
- Availability windows ("only during this week").
- Reviews, and sorting sellers by them.
- **Penalties:** reducing an allowance, fines, a period where the person can't buy, or something the other side decides. Grouped into severity levels, with the penalty given by the severity of the act. Each market defines its severity levels and how judgement works (both sides agree, a market member acting as judge, a judge from the platform, or an AI). See `docs/ideas.md`.

## Why
- **Offers made through proposals** mean nobody sells something they didn't agree to, and accepting is the promise.
- **Commitments** let buyers trust an offer.
- **Holding the coins** at purchase means a buyer can't spend them twice, and a seller can't be paid for work they didn't do.
- **Leaving is blocked while you owe work**, so nobody can take coins and walk away.
- **Timers use catch-up, like the allowance (decision 0017):** whenever a market is used, the backend handles anything that expired, with no always-on server.

## How it will be built
Four steps, each tested on the phones before the next:
1. products, proposals, offers, closing
2. buying, held coins, completing orders, refunds, stock, the leaving rules
3. missed deadlines, new deadlines, sellers ending late orders
4. disputes and the reports table
