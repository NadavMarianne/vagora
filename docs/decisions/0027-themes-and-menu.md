# 0027: Themes and the menu

**Date:** 2026-11-07 **Status:** Accepted

## Decision
- **Seven looks**, chosen **per person** and saved on their account, so each person sees the app their own way: **Night** (the default), **Clean**, **Warm**, **Velvet**, **Neon**, **Paper and ink**, and **Bold pop**, in that order. Each sets the colors, fonts, corner shapes, border thickness, and shadows. They were picked from a page of mockups (seven directions).
- Every look keeps the same color meanings: green to agree or admit, red to contest or dispute, orange for warnings.
- The fonts come from Expo's Google Fonts packages, built into the app (only the weights the looks use).
- **A ☰ menu** next to the bell in the top corner of every screen. Inside a market it holds the market's Members (with open invites), Invite someone, Market settings, and Leave market. Always: your markets (to switch or create one), Home, Notifications, Settings (your name and your look), and Log out.
- A market's page keeps only the essentials: the balance, Store, Orders, and recent transactions.

## Why
The first version is a gift, and how it looks matters as much as what it does. Different people like very different looks, so each person picks their own. The menu keeps the main screens short.

## Alternatives considered
- One look for everyone, or one per market: simpler, but someone always gets a look they didn't choose.
- System fonts only: lighter, but the looks lose most of their character.
- A navigation library for the menu: a panel built with what the app already has was enough.
