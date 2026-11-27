# 0017: Allowance

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Each market can have **any number of allowances** (updated 2026-10-30). Each one has its own **name** (shown on every payment, like "+100 Pocket money"; names may repeat), **amount**, **on/off switch**, and **schedule**. There's no limit on how many; if abuse ever slows the app, a generous safety cap can be added.

Each allowance gives its members the same amount of coins on a flexible schedule:

| Frequency | The market picks | Example |
|---|---|---|
| Daily | One or more times a day | 09:00 and 21:00 |
| Weekly | One or more weekdays, and time(s) | Sunday and Wednesday at 10:00 |
| Monthly | One or more dates, and time(s) | The 1st and the 15th at 08:00 |
| Yearly (2026-11-27) | A day of the year, and time(s) | Every December 11th at 09:00 |
| Once (2026-11-27) | One day, and time(s) | 2026-12-11 at 09:00 |

- A monthly date that doesn't exist in a shorter month (like the 31st) becomes that month's last day.
- A yearly February 29th is paid on the 28th in other years.
- **Who gets it** (2026-11-27): everyone (the default, including people who join later) or only chosen members.
- **When it's valid** (2026-11-27): optionally only from a day, until a day, or both (days in the market's time zone, both included). With neither, it never expires. An allowance past its last day stays in the list marked "ended", and can be extended or removed.
- Changing who gets it or its valid days starts it fresh, like a schedule change, so nobody is paid for the time before.
- The allowance can be switched off and on.
- Someone who joins gets their first allowance on the next scheduled time. Their starting amount covers them until then. Joining on the 13th with a payout on the 14th means you get it.
- **No allowance for time away.** Someone who leaves and comes back is paid again from the moment they return, never for the time they were gone.
- **Changing an allowance's schedule** (or switching it on): payouts whose time already passed are paid first, under the old settings. Then the new timing starts immediately for that allowance only, and anything its old schedule had coming is dropped. Switching it on never pays for the past. Renaming it or changing its amount doesn't restart it.
- **Changing the market's time zone** restarts every allowance the same way.
- **Time zone:** each market has one. It defaults to the creator's time zone and can be changed to any time zone. All schedule times use it.

## Delivery: catching up
Nothing runs on a timer. Whenever a market is used, the backend adds any allowances that came due since the last payout, each dated with its original scheduled time. Balances and history are always correct whenever anyone looks.

Two people opening a market at the same moment can't cause a double payout: each member's payouts are claimed in one database step, and only one request can win the claim.

## Why
Flexible schedules fit the "settings, not code" rule. Catching up works on hosts that sleep when unused (see decision 0007), with nothing to miss or break.

## Alternatives considered
- A scheduled job: coins arrive at the exact minute, but needs an always-on server. Added when push notifications come.
- Both together: only worth it once something must happen on time without anyone looking.
