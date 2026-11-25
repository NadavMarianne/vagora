# 2026-11-25: when libraries are updated

- Expo had 11 small library updates waiting (like 58.0.23 to 58.0.26). Updating them would turn the next release into a new APK that has to be installed by hand, while without them all the poker work reaches the phones as an automatic update.
- Decided (0031): app library updates wait for the next planned new APK and go in together, unless it's a security problem or a bug we hit. New Expo SDKs are planned work of their own. That's how most apps do it.
- Dependabot now sends the backend's library updates, and GitHub's workflow tools, as one pull request a week each instead of one per library.
- So the birthday release stays an automatic update (v1.0.2), with nothing to install.
