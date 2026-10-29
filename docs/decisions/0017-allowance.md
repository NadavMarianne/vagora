# 0017: Allowance

**Date:** 2026-10-29 **Status:** Accepted

## Decision
Each market can give every member the same amount of coins on a flexible schedule:

| Frequency | The market picks | Example |
|---|---|---|
| Daily | One or more times a day | 09:00 and 21:00 |
| Weekly | One or more weekdays, and time(s) | Sunday and Wednesday at 10:00 |
| Monthly | One or more dates, and time(s) | The 1st and the 15th at 08:00 |

- A monthly date that doesn't exist in a shorter month (like the 31st) becomes that month's last day.
- The allowance can be switched off and on.
- Someone who joins gets their first allowance on the next scheduled time. Their starting amount covers them until then.
- **Time zone:** each market has one. It defaults to the creator's time zone and can be changed to any time zone. All schedule times use it.

## Delivery: catching up
Nothing runs on a timer. Whenever a market is used, the backend adds any allowances that came due since the last payout, each dated with its original scheduled time. Balances and history are always correct whenever anyone looks.

## Why
Flexible schedules fit the "settings, not code" rule. Catching up works on hosts that sleep when unused (see decision 0007), with nothing to miss or break.

## Alternatives considered
- A scheduled job: coins arrive at the exact minute, but needs an always-on server. Added when push notifications come.
- Both together: only worth it once something must happen on time without anyone looking.
