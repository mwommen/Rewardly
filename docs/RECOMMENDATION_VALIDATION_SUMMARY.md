# Recommendation Validation Summary

This file replaces the generated `docs/RECOMMENDATION_VALIDATION_REPORT.json`
artifact, which is intentionally ignored because it is too large for normal
source control.

## Latest Full Run

- Generated at: 2026-08-02T20:00:32.000Z
- Suite: full
- Registry version: fixture-v1
- Seed: 20260724
- Generated scenarios: 1,000
- Total evaluated scenarios: 1,104
- Passed: 1,104
- Failed: 0
- Pass rate: 100%
- Threshold failures: 0

## Coverage Highlights

- Rule types covered: category, base, rotating category, portal, statement
  credit, merchant specific
- Purchase channels covered: online, issuer portal, incompatible channel
- Classification sources covered: verified, inferred, unknown
- Confidence bands covered: high, medium, low
- Wallet sizes covered: one-card, two-card, and three-or-more-card wallets
- Currency covered: USD

## Regeneration

Run the full validation report locally when needed:

```bash
npm --prefix backend run validate:recommendations:full
```

The generated JSON report should remain local and ignored. Commit this summary
only when the externally relevant totals or validation posture changes.
