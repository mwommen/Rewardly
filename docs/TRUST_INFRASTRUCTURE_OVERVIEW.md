# Trust Infrastructure Overview

Trust Infrastructure makes Rewardly decisions explainable, evidence-backed, confidence-calibrated, reproducible, versioned, and auditable.

The canonical rule remains:

> Rewardly owns trust. Clients own experience.

## Flow

```text
Request
  -> context normalization
  -> PaymentDecisionService
  -> canonical decision result
  -> Trust Record construction
  -> public response with trust reference
  -> optional evidence, explanation, alternatives, trust, and replay APIs
```

## Boundaries

Trust Infrastructure does not choose winners. It consumes canonical decision output and creates structured trust artifacts.

The platform owns:

- explanation contract
- evidence contract
- warnings and assumptions
- confidence normalization
- replay snapshots
- independence metadata
- trust APIs

Clients own:

- presentation
- progressive disclosure
- navigation
- local loading and error states

## V1 Storage

V1 trust records and replay snapshots are in-memory runtime records. This is sufficient for local, test, and sandbox validation. Production durable storage remains a required hardening step before external partner reliance.
