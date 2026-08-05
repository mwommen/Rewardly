# Decision Replay

Decision replay verifies whether a stored Rewardly decision can be reproduced from its preserved context.

## Snapshot Contents

V1 stores a minimal replay snapshot:

- normalized payment decision request
- wallet card slugs used for evaluation
- purchase amount and currency
- merchant/category/domain/MCC inputs
- checkout context required by the decision request
- original recommended payment method
- policy/version references

Sensitive fields such as card numbers, CVVs, access tokens, passwords, and full raw client state are not stored.

## Replay Flow

```text
decisionId
  -> load Trust Record
  -> load input snapshot
  -> execute PaymentDecisionService
  -> compare original and replayed recommendation
  -> return matched, mismatched, or not_replayable
```

## Non-Replayable Decisions

A decision is not replayable when:

- the Trust Record is missing
- the input snapshot is missing
- a required historical dependency is unavailable

## V1 Limitation

V1 snapshots are in-memory. Durable replay storage is required before using replay as a production partner audit guarantee.
