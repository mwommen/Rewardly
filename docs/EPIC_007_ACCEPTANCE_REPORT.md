# EPIC-007 Acceptance Report: Wallet Coach & Opportunity Engine

## Summary

EPIC-007 adds a deterministic Wallet Coach to the Rewardly mobile MVP. The coach
analyzes the user's local wallet and completed Payment Journey entries to produce
an optimization score, top opportunity, weekly summary, success moments, and
opportunity details.

Recommendation logic was not changed. Wallet Coach consumes completed Smart Pay
data after the Rewardly API has already made a payment decision.

## Files Changed

- `mobile/src/types/walletCoach.ts`
- `mobile/src/utils/walletCoach.ts`
- `mobile/src/hooks/useWalletCoach.ts`
- `mobile/src/screens/WalletCoachScreen.tsx`
- `mobile/src/screens/OpportunityDetailScreen.tsx`
- `mobile/src/navigation/AppNavigator.tsx`
- `mobile/src/navigation/types.ts`
- `mobile/src/screens/SettingsScreen.tsx`
- `mobile/src/storage/keys.ts`
- `backend/tests/mobileWalletCoach.test.ts`
- `docs/WALLET_COACH.md`
- `docs/MOBILE_SMART_PAY_ARCHITECTURE.md`
- `mobile/README.md`
- `docs/EPIC_007_ACCEPTANCE_REPORT.md`

## Architecture

```text
Rewardly API
  -> Payment Decision Engine
  -> Mobile Smart Pay
  -> Payment Journey
  -> Wallet Coach
  -> Future AI Coach
```

The Wallet Coach is local-first in this epic. It reads:

- locally selected wallet cards
- completed Payment Journey entries
- dismissed coaching opportunities

It writes:

- latest coaching snapshot
- dismissed opportunities

The deterministic calculation lives in `mobile/src/utils/walletCoach.ts` so it
can be tested without Expo runtime dependencies.

## Opportunity Engine Design

The engine analyzes:

- wallet composition
- completed purchases
- merchant frequency
- inferred category usage
- recommendation acceptance
- optimized purchase rate

Each generated opportunity includes:

- title
- explanation
- priority
- suggested action
- why it was surfaced
- supporting payment IDs
- estimated annual value, only where repeated completed reward data supports it

Dismissed opportunities are filtered from the visible snapshot without changing
the underlying deterministic calculation.

## Optimization Score Methodology

The 0-100 score is calculated from current-month activity:

- optimized purchase rate
- recommendation acceptance rate
- category coverage
- wallet diversity
- reward signal
- missed opportunity penalty

An optimized purchase requires:

- selected card equals recommended card
- original recommendation confidence is at least 85%

Trend compares the current-month score with the previous-month score.

## Weekly Summary Calculations

The weekly summary uses completed Payment Journey entries from the last seven
days and reports:

- purchases completed
- optimized purchases
- estimated rewards
- biggest current opportunity
- strongest category

Strongest category is selected by optimized rate, then estimated rewards.

## Success Moments

Implemented deterministic progress moments:

- 25 optimized purchases
- $100 estimated rewards
- first month above 90 optimization
- restaurant expert
- travel optimizer

These are subtle coaching signals, not gamified badges.

## Validation

Executed successfully:

```bash
npm --prefix backend test -- --runInBand mobileWalletCoach.test.ts mobilePaymentJourney.test.ts
```

Result:

- 2 test suites passed
- 14 tests passed

Executed successfully:

```bash
npm --prefix backend run build
```

Result:

- backend TypeScript build passed

Executed successfully:

```bash
npm run build
```

Result:

- backend build passed
- shared core build passed
- frontend build passed

Executed successfully:

```bash
npm run extension:check
```

Result:

- extension JavaScript syntax checks passed

Executed successfully with local server binding enabled:

```bash
npm test
```

Result:

- 58 test suites passed
- 434 tests passed

Executed successfully:

```bash
node -e "...TypeScript transpile syntax check..."
```

Result:

- new mobile Wallet Coach TypeScript/TSX files parsed successfully

Attempted but blocked by missing mobile dependencies:

```bash
npm --prefix mobile run typecheck
```

Result:

- failed with `sh: tsc: command not found`
- `mobile/node_modules` is not installed in this workspace ZIP

Attempted but blocked by missing mobile dependencies:

```bash
npm --prefix mobile run lint
```

Result:

- failed with `sh: eslint: command not found`
- `mobile/node_modules` is not installed in this workspace ZIP

## Screenshots / GIFs

No runtime mobile screenshots were captured in this environment because Expo
dependencies are not installed. The implementation is covered by pure utility
tests and a TypeScript syntax transpile check.

## Known Limitations

- Mobile runtime/typecheck still requires installing `mobile/node_modules`.
- Mobile lint still requires installing `mobile/node_modules`.
- Category grouping is inferred from completed journey merchant names and
  existing recommendation explanation text.
- Annual value estimates only appear with repeated completed purchases that have
  reward values.
- No cloud sync, AI coaching, push notifications, OCR, bank sync, or subscription
  features were added.

## Future Roadmap

Future AI coaching should consume the deterministic Wallet Coach snapshot. It
should not choose cards, fabricate values, or replace the Payment Decision
Engine.

Recommended next work:

1. Install mobile dependencies and run Expo/mobile typecheck.
2. Capture mobile screenshots for Coach Home and Opportunity Detail.
3. Add cloud-backed coach sync after beta validation.
4. Add AI summary generation only after deterministic coaching output is trusted.
