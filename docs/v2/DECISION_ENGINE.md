# Decision Engine Architecture

## Internal Interface

```typescript
interface PaymentDecisionEngine {
  evaluate(
    input: PaymentDecisionInput,
    context: DecisionExecutionContext
  ): Promise<PaymentDecisionResult>;
}
```

## Pipeline

| Stage | Inputs | Outputs | Failure behavior | Exists now | Migration |
| --- | --- | --- | --- | --- | --- |
| Request validation | API request | Valid input/errors | 4xx stable error | Partial | Build facade |
| Tenant resolution | API key | org/env context | 401/403 | No | Build |
| Wallet resolution | inline or stored wallet | owned methods | no decision/4xx | Yes consumer | Generalize |
| Payment normalization | card slugs | canonical methods | unknown-card error | Partial | Harden |
| Merchant normalization | name/domain/MCC | identity/category/confidence | lower confidence | Yes | Preserve |
| Purchase normalization | amount/channel/items | purchase context | warnings | Yes | Wrap |
| Data-version resolution | env/version headers | pinned versions | version error | Partial | Build |
| Eligibility evaluation | rules/state/context | applicable rules | rejected reasons | Yes | Preserve |
| Reward evaluation | benefits/amount | quantities/value | unknown estimate | Yes | Preserve |
| Benefit/offer/protection eval | state/context | value/warnings | do not overstate | Partial | Expand later |
| Candidate scoring | card rule traces | score | no winner | Yes | Preserve |
| Winner selection | candidates | winner/runner-up | tie status | Yes | Preserve |
| Explanation | trace | summary/reasons | fallback from rule | Yes | Public/private layers |
| Confidence | evidence | score/level/factors | warning | Yes | Preserve |
| Audit trace | input/output versions | decision record | best-effort, alert | Yes partial | Tenant scope |
| Analytics | decision metadata | usage/events | nonblocking | Yes | Generalize |

## Incremental Value

Definition: estimated value of recommended method minus estimated value of next-best eligible owned method.

One-card wallet: return `incrementalValue: null` with warning `no_alternative`.
Tie: return `tie: true` and stable deterministic tie-break reason.
Protections: do not monetize in MVP unless partner provides valuation.
Offers/credits: include only when eligibility/state is known enough.
Language: use "estimated additional value", never guaranteed savings.
