# 2026-11-02: Store, step 3 (missed deadlines)

- Merged PR #34 (product owners).
- Built missed deadlines. A fixed deadline that passes, or an "on request" order the buyer marks as refused, becomes a missed deadline. The buyer then chooses, with no time limit: cancel, wait for it anyway, or propose a new deadline (with an answer time they pick). Missing a new deadline is another miss.
- The seller can end a missed order at any point: a full refund, counted as refusing.
- Spotted a loophole: a buyer could tap Refused right after being served and get a refund. Decided a refund triggered by the buyer's claim waits for a contest window (a market setting, 1 day by default). If the seller says it was done, it becomes a dispute for the court, where lying can bring a counter punishment. Recorded in decision 0021.
- Tried it on the phone. Removed the "wait for it anyway" button: waiting is what doing nothing means, and the order page now says so.
- The order page now shows "What happened" (the order's story) and "What happens next" for both sides. Added short explanations to the store, product, and orders pages.
- Buttons got colors: green to agree or admit, red to contest or dispute. Every button with a deadline shows a time bar that drains as its time runs out (cancelling before a deadline, "I did it", disputing, agreeing to a new deadline, admitting or contesting a cancellation, accepting invites and proposals, approving requests).
- Second round of design changes: time bars now drain smoothly, in the button's full color, with the title turning white where it's filled.
- Notifications now open the exact page they're about (the order, the proposal, the product), not just the market. They can be swiped sideways to dismiss.
- Explanations moved into highlighted boxes at the top of the store, product, orders, order, and proposal pages, in plainer words.
- Found a crash: pressing "It wasn't done" froze and closed the app. The time bar was one animation lasting until the deadline (3 days), and the phone plans every frame of an animation ahead, about 15 million frames. Now the bar drains in 30-second steps. Also fixed the white title showing over the white part of timed buttons.
- Next: the limits file, then the court.
