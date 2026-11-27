# 2026-11-27: the birthday plan, and sending coins

## The plan until the birthday (2026-12-11)
- Surprise: she gets the app on her birthday, so it's a fresh install of a new APK. New native parts (like push notifications) are fine now.
- To build, in this order: sending coins, allowances for chosen members, push notifications, a birthday welcome. Last day for new features: 2026-12-07. Then the release and a full test on her phone.
- The Expo library updates go into that final APK (decision 0031).
- Login emails from our own domain: after the birthday.

## Sending coins (issue #46)
- Decided: a "Send coins" button on a member's page (member pages are per market, like the currency), an optional note of up to 100 characters, and a confirm step, since sent coins can't be taken back.
- Only when the market's "Members can send coins to each other" switch is on. The switch is back in the market settings (it was hidden until now).
- Nobody can send more than they have. The coins leave one balance and reach the other in one step, with an entry in each history ("To Noa: Happy birthday", "From Nadav: Happy birthday"), and the other member gets a notification.
