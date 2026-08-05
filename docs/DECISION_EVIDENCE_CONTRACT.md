# Decision Evidence Contract

Decision evidence proves why a Rewardly recommendation is trustworthy.

## Contract

```ts
type DecisionEvidenceItem = {
  evidenceId: string;
  type: string;
  source: string;
  sourceReference?: string;
  statement: string;
  effect: "supports" | "limits" | "excludes" | "informational";
  subjectId?: string;
  ruleId?: string;
  value?: number | string | boolean;
  unit?: string;
  version?: string;
  effectiveAt?: string;
  expiresAt?: string;
  confidence?: number;
};
```

## Public Evidence Types

- `WALLET_OWNERSHIP`
- `MERCHANT_MATCH`
- `CATEGORY_MATCH`
- `BASE_REWARD_RULE`
- `BONUS_REWARD_RULE`
- `BENEFIT_ELIGIBILITY`
- `PROTECTION_ELIGIBILITY`
- `OFFER_ELIGIBILITY`
- `SPENDING_CAP_STATE`
- `ENROLLMENT_STATE`
- `USER_PREFERENCE`
- `DECISION_POLICY`
- `ALTERNATIVE_COMPARISON`
- `DATA_FRESHNESS`
- `RULE_VERSION`

## Safety Rules

- Evidence must be externally safe.
- Evidence must not expose card numbers, CVVs, access tokens, passwords, or raw database records.
- Evidence ordering must be deterministic.
- Evidence should reference canonical sources when available.
