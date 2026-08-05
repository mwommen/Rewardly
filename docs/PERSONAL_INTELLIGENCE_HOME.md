# Personal Intelligence Home

The Personal Intelligence Home replaces the prior nearby-first mobile home screen.

## Purpose

The home screen answers: "What is the smartest thing I can do right now?"

It composes existing platform capabilities:

- Cloud Wallet
- Wallet Coach
- Payment Journey
- Planned Spending
- Context Awareness
- Merchant shortcuts and favorites

## Prioritization

The mobile app uses a deterministic Daily Briefing engine to rank context cards:

1. Empty wallet guidance
2. Active shopping plans
3. Nearby Smart Pay opportunity
4. Wallet Coach opportunity
5. Recent smart decision
6. Weekly progress
7. Default Smart Pay

The app shows only the most relevant cards, rather than every possible data point.

## Navigation

Each card owns one primary action:

- Add card
- Start Smart Pay
- Open Smart Pay for a merchant
- Review a shopping plan
- Open Wallet Coach
- View Payment Journey
- View a saved payment decision

This preserves existing screens while reducing the number of taps from home.

## Platform Boundary

The mobile client does not calculate recommendation winners. It only orchestrates existing API and local platform outputs into a clearer consumer experience.
