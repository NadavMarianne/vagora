# vagora

> A virtual agora: build your own markets, currencies, and ways to earn.

**Status:** phase 1, setting up the environment. The backend only has a health check so far.

## What is it?

vagora lets a small group (to begin with, two people) run their own little market:

- their own **currency**
- a **shop** of things to buy (a favor, a treat, a night off the dishes)
- **ways to earn** currency (a weekly allowance, bonuses for doing things for each other)

Everything is meant to be **configurable from inside the app**, with no code changes needed to add a new idea.

## Why does this repo exist?

This project is built in the open and documented step by step. The history, the decisions, and the mistakes are all part of the project.

- Vision and goals: [docs/vision.md](docs/vision.md)
- Why we chose what we chose: [docs/decisions/](docs/decisions/)
- Build diary: [docs/devlog/](docs/devlog/)
- Working rules: [CLAUDE.md](CLAUDE.md)

## Getting started

Open the folder in VS Code and choose **Reopen in Container**, then run `make test`. Details: [docs/setup.md](docs/setup.md).

## Roadmap

1. **Environment:** repo, dev setup, file structure, automatic checks and tests
2. **Backend:** coins, shop, orders, rules
3. **App screen:** what you see on your phone
4. **Integration and testing**, then **release v0.1**
5. Later: more than one market, native apps, public product

## Principles

- Virtual currency only. No real money, ever.
- Keep it simple. Add complexity only when there is a real need.
