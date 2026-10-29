# Future ideas

Good ideas that aren't being built yet. When one is picked up, it gets a decision record.

## Accounts
- Changing your username, limited to about once every 30 days.
- Logging in with your username, through the backend so emails stay private (see decision 0013).
- Disabling an account instantly, not only when its login expires (needs a Firebase secret key; see decision 0014).

## Markets and members
- Invite links or codes, single-use or expiring.
- Owner or admin roles, including removing members.

## Coins
- Optional debt (balances below zero), with limits.
- Different allowance amounts per person, for example as a penalty.
- Rules that give or take coins automatically, like "+1000 on your birthday" or "−500 for a broken promise".
- Earning coins through tasks.

## Time
- A clock in each market showing the market's time.
- Showing every time in each person's own time zone.

## Notifications and jobs
- Push notifications, like "your allowance arrived". This brings a scheduled job.
- In production on paid hosting, scheduled jobs take over timed work, such as deleting old empty markets.
