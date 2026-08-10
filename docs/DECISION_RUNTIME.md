# Decision Runtime

Rewardly decisions are first-class runtime objects. The runtime owns lifecycle,
persistence, replay metadata, runtime events, and identity. The Decision Engine
continues to own recommendation logic.

## Runtime Flow

```text
Payment Decision Request
  -> V1 payment decision controller
  -> Decision Runtime
  -> PaymentDecisionService
  -> Canonical Decision Object
  -> Runtime Persistence
  -> Validation Engine
  -> API Response
```

## V1 API Module Ownership

The V1 payment decision API is decomposed into focused modules under
`backend/src/routes/v1/payment-decisions/`:

- `routes.ts`: payment decision HTTP route registration only.
- `controller.ts`: request orchestration only.
- `requestMapper.ts`: public V1 request to canonical engine request.
- `responseMapper.ts`: engine/runtime output to public V1 response.
- `validation.ts`: public request validation.
- `runtimeRoutes.ts`: runtime, validation, event, and replay artifact routes.
- `middleware.ts`: request-scoped auth context helpers.
- `cardCatalogRoutes.ts`: developer card catalog route.
- `openapi.ts`: V1 OpenAPI assembly.

The top-level `paymentDecisionRoutes.ts` now composes these modules and
re-exports compatibility helpers used by existing partner routes and tests.

## Decision Entity

The persistent `DecisionObject` includes:

- `id` / `decisionId`
- `requestId`
- lifecycle `status`
- `userId`
- `partnerId`
- merchant, wallet snapshot, and purchase context
- recommendation and alternatives
- confidence and confidence factors
- evidence and warnings
- decision policy
- runtime, engine, knowledge, registry, benefit, and rule versions
- latency
- creation and update timestamps
- replay availability and replay status
- validation status and trust score metadata
- immutable runtime event history

## Lifecycle State Machine

Current runtime transitions:

```text
received -> evaluating -> recommended -> persisted -> replayable
```

Future lifecycle states are represented but do not yet carry product behavior:

- `accepted`
- `rejected`
- `expired`
- `validated`
- `superseded`
- `archived`

Invalid transitions throw before persistence.

Validation is intentionally tracked as a separate state from runtime lifecycle.
The runtime owns lifecycle, persistence, events, replay, and metadata. The
Validation Engine owns validation status, trust score, confidence calibration,
rule validation, and recommendation verification. Runtime may attach validation
metadata after validation completes, but it does not perform validation itself.

## Runtime Events

Each decision stores structured immutable events:

- `DecisionReceived`
- `MerchantResolved`
- `WalletLoaded`
- `BenefitsEvaluated`
- `ConfidenceCalculated`
- `RecommendationGenerated`
- `DecisionPersisted`
- `DecisionReplayable`
- `ReplayRequested`

Each event includes `eventId`, `decisionId`, `type`, `component`, `timestamp`,
`durationMs`, and metadata.

## API Endpoints

- `POST /api/v1/payment-decisions` creates and persists a runtime decision.
- `GET /api/v1/decisions/{decisionId}` returns the canonical decision object.
- `GET /api/v1/decisions/{decisionId}/events` returns runtime events.
- `POST /api/v1/decisions/{decisionId}/replay` initializes replay from the
  stored input snapshot and records a replay event.
- `GET /api/v1/decisions/{decisionId}/validation` returns validation metadata.
- `POST /api/v1/decisions/{decisionId}/validate` reruns or resolves validation.
- `GET /api/v1/validations/{validationId}` returns a validation result.

## Persistence

Production database initialization creates indexes for runtime and validation
artifacts:

- `decisionRuntime`: unique decision/user/partner lookup plus owner and partner
  time-series lookup indexes.
- `decisionValidations`: unique decision/user/partner lookup, validation id
  lookup, and owner/partner time-series lookup indexes.

## Remaining Production Gaps

- Runtime persistence currently uses MongoDB in non-test environments and an
  in-memory store for tests/local memory mode.
- Exact historical replay is version-pinned structurally, but full historical
  knowledge snapshots are still a future requirement.
- Runtime events are persisted with the decision object; a future event stream
  can move them into an append-only collection without changing the public
  contract.
