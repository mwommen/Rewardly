# Decision Log

## B2B Pivot

Decision: Pivot Rewardly V2 to B2B payment intelligence infrastructure.
Date: 2026-07-29
Status: Recommended
Context: Existing codebase contains reusable engine assets; consumer extension market is crowded.
Options: consumer extension, B2B API, issuer-only platform.
Chosen option: B2B API.
Rationale: higher leverage and better use of built IP.
Consequences: extension becomes reference client.
Revisit trigger: discovery shows no design-partner willingness.

## Initial ICP

Decision: Target PFM/AI finance apps first.
Status: Recommended
Rationale: reachable, wallet-aware, explainability need.
Revisit trigger: first 20 interviews produce stronger pull elsewhere.

## Wallet Strategy

Decision: Inline wallet first, persisted wallets next.
Status: Recommended
Rationale: fastest integration and privacy-minimizing.
Revisit trigger: partners require stateful benefit tracking immediately.

## API Key Model

Decision: Opaque hashed keys with `rw_test_` and `rw_live_`.
Status: Recommended
Rationale: simple, familiar, safe for MVP.

## Extension Role

Decision: Reference integration and internal test client.
Status: Recommended
Rationale: demonstrates magic moment without defining company.

## Billing Model

Decision: design-partner pilots, then base plus usage.
Status: Hypothesis
Revisit trigger: pricing discovery.

## Initial Endpoint

Decision: `POST /v1/payment-decisions`.
Status: Recommended.

## Multi-Tenant Structure

Decision: organization -> environment -> keys/users/wallets/decisions.
Status: Recommended.

## Sandbox Scope

Decision: real API contract, request builder, raw response, code samples.
Status: Recommended.
