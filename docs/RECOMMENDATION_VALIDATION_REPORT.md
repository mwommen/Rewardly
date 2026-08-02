# Recommendation Validation Report

Generated: 2026-08-02T20:00:32.000Z
Commit SHA: local
Benefit Registry version: fixture-v1
Suite: full
Test seed: 20260724
Generated scenarios: 1000

## Summary

Total scenarios: 1104
Passed: 1104
Failed: 0
Pass rate: 100.00%

## Results By Purchase Category

- dining: 140/140 passed (0 failed)
- grocery: 138/138 passed (0 failed)
- gas: 143/143 passed (0 failed)
- travel: 146/146 passed (0 failed)
- drugstore: 138/138 passed (0 failed)
- streaming: 130/130 passed (0 failed)
- general_retail: 135/135 passed (0 failed)
- unknown: 134/134 passed (0 failed)

## Failure Categories

No failures.

## Coverage

Rule types: category=427, base=637, rotating_category=20, portal=37, statement_credit=3, merchant_specific=3
Purchase channels: online=1064, issuer_portal=40, incompatible_channel=5
Classification sources: verified=802, inferred=293, unknown=9
Confidence bands: high=802, low=136, medium=166
Wallet sizes: three_or_more_card_wallet=797, two_card_wallet=145, one_card_wallet=162
Currencies: USD=1104
Rejected-rule reasons: wallet_state_required=2819, BENEFIT_RESTRICTION_INCOMPATIBLE=8154, RULE_DOES_NOT_MATCH_PURCHASE=8154, exhausted=4, RULE_HAS_NO_ESTIMATED_VALUE=3, activation_required=2, BENEFIT_ACTIVATION_REQUIRED=2, BENEFIT_NOT_EFFECTIVE=1, BENEFIT_EXPIRED=1, enrollment_required=1, BENEFIT_ENROLLMENT_REQUIRED=1, BENEFIT_USER_STATUS_UNKNOWN=57
Coverage threshold failures: 0

## Mutation Smoke

- allow-non-owned-global-card-to-win: detected
- ignore-benefit-expiration: detected
- ignore-activation-requirement: detected
- ignore-enrollment-requirement: detected
- ignore-cap-exhaustion: detected
- use-wrong-point-valuation: detected
- reverse-reward-value-sorting: detected
- prefer-base-over-higher-category-rule: detected
- wallet-array-order-final-tie-break: detected
- runner-up-explanation-returned: detected

## Reproduction

Run a specific curated scenario:

```bash
npm run validate:recommendations -- --scenario dining-001
```

Run a generated scenario by seed and index:

```bash
npm run validate:recommendations -- --suite generated --seed 20260724 --scenario-index 1842
```

## Known Unsupported Cases

- Live issuer benefit freshness is not validated by this framework.
- Cross-origin iframe checkout behavior is validated by extension tests, not wallet recommendation scenarios.
- Missing flagship-card records are reported as registry data gaps rather than filled with guessed benefits.
