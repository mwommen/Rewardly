# Context Infrastructure

Context Infrastructure answers:

> What is true about this decision right now?

It is independent from presentation and recommendation scoring.

## Responsibilities

- Normalize purchase context.
- Normalize financial intent.
- Normalize user decision preferences.
- Normalize hard and soft constraints.
- Select the applicable decision policy.
- Produce a versioned canonical context object.

## Non-Responsibilities

- It does not rank cards.
- It does not calculate rewards.
- It does not choose benefits.
- It does not change merchant intelligence.
- It does not replace Trust Infrastructure.

## Flow

```text
Client submitted context
  -> Context Infrastructure
  -> canonical context
  -> Decision Infrastructure
  -> Trust Infrastructure
```

Legacy payment decision requests without context continue to behave as before.

## Canonical Categories

- Purchase context: merchant, category, amount, currency, channel, location, timestamp.
- User context: wallet card scope, preferences, constraints, history signals.
- Financial intent: why the purchase is happening.
- Decision policy: how Rewardly should optimize.

## Versioning

Context contracts use `CONTEXT_SCHEMA_VERSION`.

Decision policy contracts use `DECISION_POLICY_SCHEMA_VERSION`.

Preference contracts use `PREFERENCES_SCHEMA_VERSION`.
