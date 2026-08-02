# EPIC-009 Acceptance Report: Financial Intent Platform

## Summary

EPIC-009 introduces the Financial Intent Platform as Rewardly's orchestration
layer. Clients can submit a user intent to one versioned endpoint, and the
platform routes that intent to the correct existing capability without moving
business logic out of the underlying engines.

The implementation preserves deterministic recommendation behavior. Smart Pay
still executes through `PaymentDecisionService`; the mobile client now calls the
Intent API and unwraps the same payment decision response shape it already used.

## Files Changed

- `backend/src/services/financialIntentService.ts`
- `backend/src/routes/v1/financialIntentRoutes.ts`
- `backend/src/app.ts`
- `backend/src/routes/v1/paymentDecisionRoutes.ts`
- `backend/tests/financialIntentRoutes.test.ts`
- `mobile/src/types/financialIntent.ts`
- `mobile/src/api/rewardly.ts`
- `mobile/src/hooks/usePaymentDecision.ts`
- `docs/FINANCIAL_INTENT_PLATFORM.md`
- `docs/API_OVERVIEW.md`
- `docs/MOBILE_SMART_PAY_ARCHITECTURE.md`
- `mobile/README.md`
- `docs/EPIC_009_ACCEPTANCE_REPORT.md`

## Financial Intent Architecture

The Financial Intent Platform follows this flow:

```text
Client
  -> POST /api/v1/intents
  -> FinancialIntentService
  -> Existing platform capability
  -> Unified intent response
```

Supported intent types:

- `SMART_PAY`
- `PLAN_PURCHASES`
- `COMPLETE_PURCHASE`
- `REVIEW_PAYMENT_HISTORY`
- `VIEW_WALLET_COACH`
- `VIEW_OPPORTUNITIES`
- `VIEW_WEEKLY_SUMMARY`

The Intent Engine validates the intent envelope, validates required payload
fields for routed actions, invokes the matching capability, records a lightweight
event, and returns a unified response contract.

## Routing Implementation

Implemented routing:

- `SMART_PAY` routes to `PaymentDecisionService`.
- `PLAN_PURCHASES` routes to the existing planning optimization flow.
- `COMPLETE_PURCHASE` routes to planned-purchase completion and returns a
  warning that mobile clients should continue persisting local Payment Journey
  records.
- Read-only summary/coach/opportunity intents return deterministic
  acknowledgements through the unified contract so future backend-owned data can
  plug in without changing clients.

No recommendation scoring, merchant intelligence, wallet intelligence, or
benefit registry logic was duplicated or replaced.

## API Contract

New versioned endpoints:

```http
POST /api/v1/intents
GET /api/v1/intents/{intentId}
```

Unified response fields:

- `intentId`
- `requestId`
- `timestamp`
- `intentType`
- `executedCapabilities`
- `result`
- `warnings`
- `errors`
- `metadata.executionTimeMs`
- `metadata.success`

OpenAPI documentation was extended so `GET /api/v1/openapi.json` includes the
Financial Intent request and response schemas.

## Event Logging

The MVP records in-memory intent execution events with:

- intent type
- timestamp
- execution time
- capabilities invoked
- success or failure

This provides lightweight observability without adding analytics vendors,
authentication, billing, organizations, or cloud persistence.

## Mobile Integration

The mobile Smart Pay flow now submits:

```json
{
  "type": "SMART_PAY",
  "payload": {
    "merchant": "...",
    "purchase": "...",
    "wallet": "..."
  }
}
```

to `POST /api/v1/intents`.

The mobile API adapter unwraps `response.result` and returns the existing
`PaymentDecisionResponse` shape to the Smart Pay hook. The user experience and
screen behavior remain unchanged.

## Test Coverage

Added `backend/tests/financialIntentRoutes.test.ts` covering:

- Smart Pay intent routing to `PaymentDecisionService`
- unified response shape
- previous intent retrieval
- invalid and unknown intent errors
- planned purchase optimization routing
- planned purchase completion routing
- intent event logging
- OpenAPI schema/path coverage

Existing recommendation, payment decision, planning, checkout detection,
merchant intelligence, wallet intelligence, benefit registry, validation, and
extension checks continue to pass.

## Validation Results

Executed successfully:

```text
npm test
Test Suites: 60 passed, 60 total
Tests:       448 passed, 448 total
```

```text
npm run build
backend build: passed
shared core build: passed
frontend build: passed
```

```text
npm run extension:check
extension syntax check: passed
```

```text
mobile financial intent syntax transpile check: passed
```

Mobile validation limitation:

```text
npm --prefix mobile run typecheck
failed: sh: tsc: command not found

npm --prefix mobile run lint
failed: sh: eslint: command not found
```

The mobile scripts could not run because `mobile/node_modules` is not installed
in this checkout. The changed mobile TypeScript files were syntax-checked with
the backend-installed TypeScript compiler.

## Performance Impact

The Intent Engine adds one lightweight routing step around existing services.
It records start/end timing per request and returns `metadata.executionTimeMs`.
No new network hops, external dependencies, or long-running background work were
added.

## Known Limitations

- Intent event storage is in-memory and intended for MVP validation only.
- `GET /api/v1/intents/{intentId}` only returns intents from the current server
  process.
- Read-only intents currently return deterministic acknowledgements until those
  backend-owned data sources are formalized.
- Mobile typecheck and lint require installing mobile dependencies.
- No authentication, billing, organizations, push notifications, cloud sync, AI
  routing, or receipt OCR were added.

## Future Expansion Plan

After EPIC-009, future user features should plug into the Intent Engine instead
of introducing another top-level platform abstraction. Good next candidates are:

- receipt intelligence
- cloud sync
- authentication
- notifications
- AI coaching
- developer portal integrations

Each should register or route through Financial Intent while preserving existing
engine ownership of business logic.

## Final Status

EPIC-009 is complete for the intended MVP scope.

The platform can accept a Financial Intent, route it to the correct existing
engine, return a unified response, expose the contract through OpenAPI, log
execution metadata, and allow the mobile Smart Pay flow to consume the Intent
API without changing recommendation behavior.
