# API Architecture

## Recommendation

Launch `/v1/payment-decisions` with inline wallet support first. Add persisted wallets for design partners after the first sandbox integrations.

## Wallet Strategy

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Inline wallet every request | Fast, private, customer-controlled, easy sandbox | Larger payloads, less stateful benefit tracking | Launch default |
| Persisted Rewardly wallets | Smaller requests, better replay/state | More storage, retention/security burden | Design-partner scope |
| Both | Flexible | More contract complexity | Support, but sequence carefully |

## Initial Endpoints

- `POST /v1/payment-decisions`
- `GET /v1/cards`
- `GET /v1/merchants/resolve`
- `POST /v1/feedback`
- `GET /v1/decision-events/{id}` for test/live support
- `POST /v1/api-keys` only from dashboard/admin, not public API

## Request Rules

- Required: authenticated organization/environment, external user reference or anonymous decision reference, wallet payment methods, merchant or category/MCC evidence.
- Optional: amount, currency, channel, partner category, benefit state, valuation profile, metadata.
- Reject unknown card slugs by default.
- Reject duplicate payment methods.
- Unknown fields: reject in live, warn in test if `strict=false`.
- Currency: MVP supports USD only.
- Amount precision: decimal string or integer minor units; avoid floats internally.
- Merchant precedence: Rewardly merchant ID, then domain, MCC, partner category, name.
- Idempotency: `Idempotency-Key` scoped to org, environment, endpoint.

## Response Statuses

- `recommended`
- `no_recommendation`
- `insufficient_context`
- `unsupported_wallet`
- `unsupported_merchant`
- `low_confidence`

## Error Contract

Every error returns code, message, request ID, retryability, docs URL, and parameter details where relevant.

Codes: `missing_api_key`, `invalid_api_key`, `revoked_api_key`, `rate_limited`, `invalid_request`, `unknown_card`, `unsupported_card`, `invalid_wallet`, `unsupported_currency`, `invalid_merchant`, `missing_purchase_context`, `idempotency_conflict`, `engine_failure`, `service_unavailable`, `version_unavailable`.
