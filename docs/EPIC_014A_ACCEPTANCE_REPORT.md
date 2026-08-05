# EPIC-014A Acceptance Report

## Executive Status

APPROVED WITH WARNINGS

EPIC-014A hardens Trust Infrastructure without changing recommendation scoring, benefit calculations, merchant detection, wallet-first restrictions, decision ranking, or public payment-decision response semantics.

The Trust layer is now backed by MongoDB in non-test runtime, Trust endpoints require authenticated Rewardly access tokens, Trust lookups are owner-scoped, replay has explicit replayability metadata, replay has a dedicated rate limit, and replay snapshots retain only the minimum fields required for deterministic re-execution.

Warning: partner tenant authentication is represented in the persistence and access-scope model, but a full partner API-key authentication product is still future work.

## Files Changed

- `backend/src/db.ts`
- `backend/src/server.ts`
- `backend/src/initProductionDb.ts`
- `backend/src/services/trustInfrastructureService.ts`
- `backend/src/routes/v1/decisionTrustRoutes.ts`
- `backend/src/routes/v1/paymentDecisionRoutes.ts`
- `backend/src/services/financialIntentService.ts`
- `backend/tests/decisionTrustRoutes.test.ts`
- `backend/tests/trustInfrastructureService.test.ts`
- `backend/src/routes/v1/paymentDecisionRoutes.ts`
- `docs/EPIC_014A_ACCEPTANCE_REPORT.md`

## Durable Persistence

Trust Records persist to MongoDB collection `decisionTrustRecords`.

Replay snapshots persist to MongoDB collection `decisionInputSnapshots`.

Indexes added:

- `decisionTrustRecords`: unique `{ decisionId, ownerUserId, tenantId }`
- `decisionTrustRecords`: unique `{ trustRecordId }`
- `decisionTrustRecords`: `{ ownerUserId, createdAt }`
- `decisionTrustRecords`: `{ tenantId, createdAt }`
- `decisionInputSnapshots`: unique `{ inputSnapshotId, ownerUserId, tenantId }`
- `decisionInputSnapshots`: `{ decisionId, ownerUserId, tenantId }`

Persistence guarantees:

- Trust Records survive server restart.
- Replay snapshots survive server restart.
- Multiple API instances can read the same Trust Records through MongoDB.
- Duplicate Trust Record creation for the same owner and decision is idempotent.

## Authentication And Authorization

All Trust endpoints now require the existing Rewardly bearer access token middleware:

- `GET /api/v1/decisions/{decisionId}`
- `GET /api/v1/decisions/{decisionId}/explanation`
- `GET /api/v1/decisions/{decisionId}/evidence`
- `GET /api/v1/decisions/{decisionId}/alternatives`
- `GET /api/v1/decisions/{decisionId}/trust`
- `POST /api/v1/decisions/{decisionId}/replay`

Access checks are owner-scoped by authenticated `userId`. A user receives `404 DECISION_NOT_FOUND` when attempting to access another user's Trust Record.

The public payment-decision endpoint remains backward compatible. When a valid bearer token is supplied, the generated Trust Record is owned by the authenticated user. Client-supplied user IDs are not used as Trust ownership.

## Replay Integrity

Trust Records now include:

- `reproducibility.replayability`
- `reproducibility.replayLimitations`
- `reproducibility.missingDependencies`

Replay responses now include:

- `replayability`
- `replayQualityExplanation`

Supported replayability values:

- `replayable`
- `partially_replayable`
- `not_replayable`

Replay no longer silently implies perfect reproducibility when a required snapshot is missing.

## Privacy Hardening

Replay snapshots do not persist the original request `userId`.

Retained snapshot fields:

- `merchant.name`: required to re-run deterministic merchant resolution.
- `merchant.category`: required to reproduce category-based scoring inputs.
- `merchant.domain`: required when domain evidence influenced merchant resolution.
- `amount`: required to reproduce estimated value calculations.
- `currency`: required to preserve supported purchase currency.
- `manualCardSlugs`: required to preserve the wallet card scope evaluated.
- `purchaseContext`: limited checkout context retained only when it influenced purchase classification.

The snapshot intentionally excludes:

- card numbers
- CVV/security codes
- access tokens
- session tokens
- raw Authorization headers
- email addresses
- arbitrary client user identifiers

## Replay Rate Limiting

Replay has a dedicated per-user, per-decision limiter.

Default:

- `REWARDLY_TRUST_REPLAY_RATE_LIMIT_COUNT=10`
- `REWARDLY_TRUST_REPLAY_RATE_LIMIT_WINDOW_MS=60000`

Exceeding the limit returns:

```json
{
  "error": {
    "code": "REPLAY_RATE_LIMITED",
    "message": "Too many replay attempts. Please try again later.",
    "retryable": true
  }
}
```

## OpenAPI

Trust endpoints now declare bearer authentication and explicit schemas for:

- Trust Record
- Explanation
- Evidence
- Alternatives
- Warnings
- Assumptions
- Confidence
- Reproducibility
- Replay Result
- Pagination

## Validation Results

Executed:

```bash
npm --prefix backend run build
npm --prefix backend test -- --runInBand trustInfrastructureService.test.ts decisionTrustRoutes.test.ts paymentDecisionV1Routes.test.ts financialIntentRoutes.test.ts
```

Results:

- Repository hygiene: passed.
- Backend build: passed.
- Targeted backend tests: 25 passed, 0 failed.
- Curated recommendation validation: 104/104 passed.
- Shared core build: passed.
- Mobile typecheck: passed.
- Mobile lint: passed.
- Mobile Personal Intelligence briefing tests: passed.
- Trust route security coverage includes missing auth, malformed token, expired token, suspended user, cross-user isolation, and replay rate limiting.
- Trust service privacy coverage verifies replay snapshots do not forward the original request `userId`.

## Regression Confirmation

Unchanged:

- recommendation scoring
- benefit calculations
- merchant detection
- wallet-first restrictions
- decision ranking
- financial intent routing semantics
- existing public recommendation contracts

## Known Limitations

- Partner tenant isolation is modeled but requires a dedicated partner authentication layer before external partner launch.
- Persistence survival across an actual process restart and multi-instance deployment requires a live MongoDB environment; code paths and indexes are in place, but this report only validates local automated tests.
- Performance numbers should be measured against the production MongoDB deployment before broad external availability.

## Exact Next Step

Open pull request into `main`
