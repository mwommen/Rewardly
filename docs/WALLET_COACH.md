# Wallet Coach & Opportunity Engine

Rewardly Wallet Coach turns completed Smart Pay decisions into deterministic
coaching. It helps users understand what they are doing well, where they can
improve, and how their wallet behavior is changing over time.

Wallet Coach does not score cards, replace the Recommendation Engine, or produce
AI-generated advice. It consumes local wallet records and Payment Journey entries
created after a user completes a Smart Pay decision.

## Architecture

```text
Rewardly API
  -> Payment Decision Engine
  -> Mobile Smart Pay
  -> Payment Journey
  -> Wallet Coach
  -> Future AI Coach
```

The mobile implementation is split into:

- `mobile/src/utils/walletCoach.ts`: pure deterministic coaching calculations
- `mobile/src/hooks/useWalletCoach.ts`: local persistence and React Query wiring
- `mobile/src/screens/WalletCoachScreen.tsx`: coach home
- `mobile/src/screens/OpportunityDetailScreen.tsx`: opportunity detail
- `mobile/src/types/walletCoach.ts`: canonical mobile coach types

## Opportunity Engine

The Opportunity Engine analyzes:

- wallet composition
- completed Payment Journey entries
- merchant frequency
- inferred category usage
- recommendation acceptance
- optimized purchase rate

Every opportunity includes:

- title
- explanation
- priority
- suggested action
- why it was surfaced
- supporting payment IDs
- estimated annual value, only when supported by repeated reward data

Dismissed opportunities are stored locally and filtered from future snapshots.
Recalculation remains deterministic because dismissal affects visibility, not
underlying scoring.

## Optimization Score

The Wallet Optimization Score is a deterministic 0-100 score. It is calculated
from the current month using:

- optimized purchase rate
- recommendation acceptance rate
- category coverage
- wallet diversity
- reward signal
- missed opportunity penalty

An optimized purchase means the selected card matched the recommended card and
the original decision confidence was at least 85%.

Trend compares the current-month score with the previous-month score.

## Weekly Summary

The weekly summary uses Payment Journey entries from the last seven days.

It includes:

- purchases completed
- optimized purchases
- estimated rewards
- biggest opportunity
- strongest category

Strongest category is selected by optimized rate, then estimated rewards.

## Success Moments

Success moments are subtle progress signals. They are deterministic and based on
completed journey data:

- 25 optimized purchases
- $100 estimated rewards
- first month above 90 optimization
- restaurant expert
- travel optimizer

These are intentionally not badges, streaks, or gamified rewards.

## Persistence

Stored locally with Expo Secure Store:

- latest coaching snapshot
- dismissed opportunities

The snapshot is persisted for continuity, but the source of truth remains the
wallet and Payment Journey. Recalculation from the same inputs produces the same
coaching output.

## Future AI Integration Plan

Future AI coaching should consume the deterministic Wallet Coach snapshot rather
than raw recommendation internals.

AI may help with:

- summarizing opportunities in a friendlier tone
- answering questions about a user's progress
- explaining why an opportunity matters

AI must not:

- choose the payment method
- fabricate reward values
- override the Recommendation Engine
- hide uncertainty or unsupported estimates

## Known Limitations

- Category grouping is inferred from completed journey merchant names and
  existing recommendation explanations.
- Annual value estimates require repeated completed purchases with reward values.
- There is no cloud sync in this epic.
- There are no push notifications, background location, receipt OCR, or bank
  integrations.
