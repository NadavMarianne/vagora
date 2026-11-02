# 0023: Reports and cases

**Date:** 2026-11-02 **Status:** Accepted

Replaces section 7 of decision 0021 (disputes and reports). The court itself is decision 0024. Items marked **Open** aren't decided yet.

## The flow at a glance
1. A report is filed.
2. The bot checks it against the facts the system recorded.
3. If it passes, both sides are invited to court and a time is scheduled.
4. Until court, both sides can settle.
5. If they don't, they go to court (decision 0024): the judge hears both sides and gives a verdict and a severity.
6. For heavier cases, a second session with the punisher decides the punishment.
7. The verdict is delivered, and the case is closed and logged.

**Nothing is given or taken outside a verdict or a settlement.** Coins still held (for example in a disputed order) stay held until then.

## 1. Reports
- The person who was wronged files a report naming one or more violations and the **date each happened**. What's written is what happened.
- A report can be filed:
  - after a missed deadline or a refusal, while the order's own choices still apply (waiting, a new deadline, cancelling)
  - after work was done late. Late is softer than never.
  - when an "I did it" is disputed. **A dispute is a case.**
  - by a seller, as a counter report
  - when a punishment is refused or missed (section 5)
- **Filing window:** within **3 days** (market setting) after the outcome is final: the order was cancelled, done late, or a new deadline was missed. After that, the violation can't be reported.
- **A filed report never expires.** It ends in court or is dismissed by the bot.

## 2. The bot's check
The bot (an AI, decision 0024) compares the report with the recorded facts:
- **The facts match:** a court invitation is sent.
- **The facts conflict:** the report is dismissed.
- **No recorded facts either way**, and the bot thinks it needs clarifying: a court invitation is sent.

## 3. Scheduling the court
1. Each side picks the **dates and hour ranges** they're available within the next **3 days** (market setting).
2. Court is set for the **closest time that fits both**.
3. If nothing fits, the system picks a **random time in the following 3 days**.

**Cases about a refused or missed punishment** go to court the **next day**. Each side picks their hours for that day. If nothing fits, a random time that day.

Times are in the market's time zone.

## 4. Settling
- At any time before court, both sides can settle without a judge, as in real life.
- Both describe the reward or punishment and submit it.
- The AI checks it fits the limits files (decision 0022) and the severity bounds. If it does, it's applied, and the case closes.
- If it doesn't, they can change it or go to court.
- Giving up in a dispute (decision 0021) is a settlement: the side giving up accepts the other side's outcome.

## 5. After the verdict
- A punishment comes with a **deadline** to fulfil it. A reward comes with an **expiry date** to use it.
- **Refusing or missing a punishment** opens a **new case** against the accused, reported as usual. The next punishment has a **higher severity** (how much higher: **Open**).
- When the refused punishment was already at the **maximum severity**, the **backstop** applies instead (decision 0024).
- The case is **closed and logged**. The log keeps the report, the bot's facts, and the verdict, never the punisher's private conversation (**Open:** exactly what else).

## 6. Leaving the market
- **A court date waiting** blocks leaving. So does an open order, and a punishment counts as one. Punishments can't be escaped by leaving.
- **An open report doesn't block leaving.** If it reaches court after the person returns and they're found guilty, the severity is higher because they left. If they're found innocent, nothing happens.
- Otherwise decision 0021 (section 8) applies.

## Open
How much the severity rises per refusal, and what the log keeps.
