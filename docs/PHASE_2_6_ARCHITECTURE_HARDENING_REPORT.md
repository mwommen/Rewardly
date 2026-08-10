# Rewardly Phase 2.6 Architecture Hardening Report

Date: 2026-08-10

## Summary

Phase 2.6 reduced the V1 payment decision route from a monolithic platform
choke point into focused API modules. The refactor preserves externally
observable behavior while clarifying ownership between routing, orchestration,
request mapping, response mapping, validation, runtime artifacts, OpenAPI, and
developer card catalog access.

No recommendation logic was changed.

## Modules Created

`backend/src/routes/v1/payment-decisions/`

- `routes.ts`: registers `POST /payment-decisions`.
- `controller.ts`: orchestrates request validation, runtime creation,
  validation attachment, and response shaping.
- `requestMapper.ts`: maps public V1 request bodies to
  `PaymentDecisionRequest`.
- `responseMapper.ts`: maps engine/runtime/trust/validation output to the V1
  response contract.
- `validation.ts`: owns public V1 request validation and normalization.
- `middleware.ts`: owns optional auth and access-scope helpers.
- `runtimeRoutes.ts`: owns runtime, validation, event, and replay artifact
  routes.
- `cardCatalogRoutes.ts`: owns `GET /card-catalog`.
- `errors.ts`: owns consistent runtime/validation not-found responses.
- `openapi.ts`: owns V1 OpenAPI document assembly.

The existing `backend/src/routes/v1/paymentDecisionRoutes.ts` now composes these
modules and re-exports compatibility helpers used by existing tests and partner
routes.

## Ownership Boundaries

Decision Engine:

- recommendation
- alternatives
- decision confidence
- recommendation facts

Decision Runtime:

- lifecycle
- persistence
- runtime events
- replay metadata
- durable decision object metadata

Validation Engine:

- validation status
- trust score
- confidence calibration
- rule consistency checks
- recommendation verification

API Layer:

- HTTP routing
- request validation
- request mapping
- response mapping
- OpenAPI contract

Developer Platform:

- rendering
- playground
- inspector
- developer experience projections

## Persistence Hardening

Production database initialization now includes indexes for:

- `decisionRuntime`
- `decisionValidations`

The indexes cover decision lookup, validation lookup, owner-scoped lookup,
partner-scoped lookup, and uniqueness for decision artifacts.

## API Contract Changes

No intentional public API contract changes were made.

Compatibility preserved:

- `POST /api/v1/payment-decisions`
- `GET /api/v1/decisions/:decisionId`
- `GET /api/v1/decisions/:decisionId/events`
- `POST /api/v1/decisions/:decisionId/replay`
- `GET /api/v1/decisions/:decisionId/validation`
- `POST /api/v1/decisions/:decisionId/validate`
- `GET /api/v1/validations/:validationId`
- `GET /api/v1/openapi.json`
- `GET /api/v1/card-catalog`

The top-level route continues to export:

- `V1_PAYMENT_DECISIONS_ROUTE`
- `openApiDocument`
- `validatePaymentDecisionRequest`
- `toV1PaymentDecisionResponse`
- `createPublicDecisionId`

## Regression Protection

Validation run during this sprint:

```bash
npm --prefix backend test -- --runInBand tests/paymentDecisionV1Routes.test.ts tests/decisionValidationService.test.ts
npm --prefix backend run build
```

Results:

- 2 backend test suites passed.
- 18 tests passed.
- Backend TypeScript build passed.

## Remaining Technical Debt

The following items remain before broad external production usage:

- Runtime replay still needs explicit production rate-limit coverage on the
  actually mounted route.
- Runtime and trust route ownership should be reconciled so only one router owns
  each `/api/v1/decisions/*` endpoint.
- Validation versioning still needs supersede behavior when
  `DECISION_VALIDATOR_VERSION` changes.
- Runtime events are still embedded with the decision object rather than stored
  in an append-only event collection.
- Runtime, validation, replay, and event endpoints should require explicit
  production auth/API-key policy outside sandbox.

## Recommendation Before Design Partners

This refactor improves maintainability and makes the V1 platform easier to
extend. Before design partner integrations, prioritize:

1. Replay rate-limit enforcement on the runtime replay route.
2. Runtime/trust route ownership reconciliation.
3. Authorization tests for decision runtime, validation, replay, and events.
4. Validator version/supersede tests.
5. A single Design Partner Quick Start that reflects the new route/module
   architecture.
