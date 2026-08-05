# EPIC-014 Acceptance Report

## 1. Executive Status

APPROVED WITH WARNINGS

EPIC-014 establishes Trust Infrastructure v1 by creating canonical public trust records, structured explanations, evidence, alternatives, warnings, assumptions, confidence, replay snapshots, trust APIs, and mobile trust consumption.

Warning: V1 trust storage is in-memory. Durable database persistence and strict authenticated partner ownership checks remain required before this is a production-grade external audit system.

## 2. Architecture Summary

Trust Infrastructure sits after the canonical Payment Decision Service.

```text
Request
  -> context normalization
  -> PaymentDecisionService
  -> decision result
  -> Trust Record construction
  -> audit/trust APIs
  -> client presentation
```

Trust Infrastructure does not rescore cards or choose winners. It adapts canonical decision output and existing decision intelligence into stable public trust contracts.

## 3. Canonical Contracts

- Trust Record: canonical container for recommendation, explanation, evidence, alternatives, warnings, assumptions, confidence, versions, reproducibility, provenance, and timestamps.
- Explanation: human-readable and machine-readable reason contract.
- Evidence: structured proof items with source, effect, subject, rule, value, version, and confidence where available.
- Alternatives: meaningful non-winning evaluated cards from the user wallet.
- Warnings: material uncertainty clients should surface.
- Assumptions: explicit facts Rewardly used, separated by user, platform, inferred, and default sources.
- Confidence: normalized trust quality, separate from financial value.
- Replay Result: matched, mismatched, or not replayable comparison.

## 4. API Changes

Additive:

- `GET /api/v1/decisions/{decisionId}`
- `GET /api/v1/decisions/{decisionId}/explanation`
- `GET /api/v1/decisions/{decisionId}/evidence`
- `GET /api/v1/decisions/{decisionId}/alternatives`
- `GET /api/v1/decisions/{decisionId}/trust`
- `POST /api/v1/decisions/{decisionId}/replay`
- `POST /api/v1/payment-decisions` now includes optional `trust`.
- Financial Intent `SMART_PAY` responses now include optional `trust`.

Breaking changes: none intended.

## 5. Decision Flow

1. Client submits payment decision or SMART_PAY intent.
2. Existing request validation normalizes merchant, purchase, and wallet.
3. `PaymentDecisionService` produces the canonical recommendation.
4. Trust Infrastructure creates or resolves an idempotent Trust Record.
5. Public response includes a trust reference.
6. Clients can retrieve full explanation, evidence, alternatives, trust, or replay.

## 6. Replay Behavior

V1 snapshots:

- normalized payment decision request
- wallet card slugs
- purchase amount and currency
- merchant context
- checkout context
- original recommendation
- policy/version references

Replay executes the canonical Payment Decision Service and compares the recommendation ID/display name. Missing trust record or missing input snapshot returns `not_replayable`.

## 7. Authorization

Real HTTP isolation tests for authenticated partner tenants are not complete in V1. Current public V1 trust records are scoped by opaque `decisionId` and are not suitable as a long-term authorization boundary.

## 8. Performance

Trust construction is synchronous, deterministic, and bounded by `MAX_PUBLIC_EVIDENCE_ITEMS = 40` and `MAX_PUBLIC_ALTERNATIVES = 3`. The EPIC-014 verification suite completed successfully in 6.4 seconds on the local development machine, including backend build, targeted backend tests, curated recommendation validation, shared package build, and mobile checks.

## 9. Files Created

- `backend/src/services/trustInfrastructureService.ts`
- `backend/src/routes/v1/decisionTrustRoutes.ts`
- `backend/tests/trustInfrastructureService.test.ts`
- `backend/tests/decisionTrustRoutes.test.ts`
- `docs/EPIC_014_TRUST_INFRASTRUCTURE_AUDIT.md`
- `docs/TRUST_INFRASTRUCTURE_OVERVIEW.md`
- `docs/DECISION_EXPLANATION_CONTRACT.md`
- `docs/DECISION_EVIDENCE_CONTRACT.md`
- `docs/CONFIDENCE_CONTRACT.md`
- `docs/DECISION_REPLAY.md`
- `docs/DECISION_REASON_CODES.md`
- `docs/TRUST_API_REFERENCE.md`
- `docs/PLATFORM_OVERVIEW.md`

## 10. Files Modified

- `backend/src/app.ts`: mounts Trust API routes.
- `backend/src/routes/v1/paymentDecisionRoutes.ts`: creates trust records and OpenAPI schemas.
- `backend/src/services/financialIntentService.ts`: includes TrustInfrastructure for SMART_PAY intents.
- `backend/src/services/planningService.ts`: allows optional trust reference on public decision responses.
- `backend/tests/financialIntentRoutes.test.ts`: updates SMART_PAY capability expectations.
- `mobile/src/api/rewardly.ts`: adds trust retrieval helper.
- `mobile/src/types/rewardly.ts`: adds trust response types.
- `mobile/src/screens/RecommendationDetailsScreen.tsx`: displays canonical trust explanation, evidence, alternatives, warnings, and trust reference.
- `package.json`: adds EPIC-014 verification command.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/API_OVERVIEW.md`, `mobile/README.md`: document trust infrastructure.

## 11. Test Results

- Repository hygiene: passed.
- Backend build: passed.
- Trust Infrastructure service tests: 5 passed.
- Decision Trust route tests: 2 passed.
- Payment Decision V1 route tests: 7 passed.
- Financial Intent route tests: 7 passed.
- Targeted backend total: 21 passed, 0 failed.
- Curated recommendation validation: 104/104 passed.
- Shared core build: passed.
- Mobile typecheck: passed.
- Mobile lint: passed.
- Mobile Personal Intelligence briefing tests: passed.
- Authorization: documented as a V1 limitation; strict authenticated partner ownership checks remain future work.

## 12. Verification Output

Run:

```bash
npm run verify:epic-014
```

Result:

```text
Repository hygiene check passed.
Backend build passed.
Test Suites: 4 passed, 4 total
Tests: 21 passed, 21 total
Recommendation validation: 104/104 passed (100.00%)
Shared core build passed.
Mobile typecheck passed.
Mobile lint passed.
Personal Intelligence briefing tests passed.
```

## 13. Known Limitations

- Trust records and replay snapshots are in-memory in V1.
- Authenticated partner ownership checks for Trust APIs are not fully implemented.
- Historical rule registry replay is represented by version references, not durable historical dependency loading.
- This is an evidence and explainability layer over the existing decision engine; it intentionally does not add new recommendation logic.

## 14. Recommendation Logic Confirmation

Unchanged:

- Recommendation scoring
- Reward calculations
- Rule precedence
- Merchant support
- Card catalog
- Wallet-first restriction
- Financial Intent routing semantics

## 15. Exact Next Step

Open pull request into `main`
