# EPIC-010 Acceptance Report: Merchant Intelligence Platform v2

## Summary

EPIC-010 promotes Merchant Intelligence into a reusable backend platform
capability. Rewardly now exposes structured merchant profiles, alias-aware
search, category lookup, metadata retrieval, deterministic merchant insights,
and mobile consumption through backend APIs.

The implementation preserves existing recommendation behavior. No merchant
recommendation logic was added to the mobile client.

## Files Changed

- `backend/src/services/merchantIntelligenceService.ts`
- `backend/src/services/merchantKnowledgeService.ts`
- `backend/src/services/merchantDetectionService.ts`
- `backend/src/routes/v1/merchantKnowledgeRoutes.ts`
- `backend/src/routes/v1/paymentDecisionRoutes.ts`
- `backend/src/app.ts`
- `backend/tests/merchantKnowledgeRoutes.test.ts`
- `mobile/src/types/rewardly.ts`
- `mobile/src/api/rewardly.ts`
- `mobile/src/hooks/useMerchantKnowledge.ts`
- `mobile/src/screens/MerchantSearchScreen.tsx`
- `docs/MERCHANT_KNOWLEDGE_PLATFORM.md`
- `docs/API_OVERVIEW.md`
- `docs/EPIC_010_ACCEPTANCE_REPORT.md`

## Architecture Updates

Merchant knowledge is centralized behind `MerchantKnowledgeService`.

```text
Merchant Intelligence Registry
  -> Merchant Knowledge Service
     -> Decision paths
     -> V1 Merchant APIs
     -> Mobile App
     -> Future partner APIs
```

`merchantDetectionService` now resolves through `resolveMerchantKnowledge()`,
which keeps existing engines connected to the centralized merchant capability.

## Merchant Domain Changes

The canonical merchant model now supports:

- supported payment methods
- loyalty programs
- merchant tags
- merchant metadata
- last updated timestamp through the existing `updatedAt` field

The existing model already covered IDs, canonical names, aliases, category,
MCCs, brand, parent company, country, region, domains, checkout domains,
billing descriptors, relationships, and confidence.

## Knowledge Service Implementation

Added `backend/src/services/merchantKnowledgeService.ts` with:

- `listMerchantProfiles()`
- `getMerchantProfile()`
- `resolveMerchantKnowledge()`
- `searchMerchantProfiles()`
- `listMerchantCategories()`
- `getMerchantInsight()`
- `buildMerchantKnowledgeSummary()`

Search supports exact name, alias, domain, brand, category, partial, and
conservative misspelling matches.

## API Endpoints

New versioned endpoints:

```http
GET /api/v1/merchants
GET /api/v1/merchants/{merchantId}
GET /api/v1/merchant-search
GET /api/v1/merchant-categories
GET /api/v1/merchant-insights
```

OpenAPI was updated through `GET /api/v1/openapi.json`.

## Mobile Integration

The mobile Merchant Search screen now consumes Merchant Knowledge APIs and shows
backend-provided merchant intelligence:

- merchant category/subcategory
- parent company/brand context
- loyalty programs

The old local merchant suggestions remain only as a fallback if the backend is
unavailable.

## Test Coverage

Added `backend/tests/merchantKnowledgeRoutes.test.ts` covering:

- merchant profile list
- merchant profile detail
- alias search
- partial search
- misspelling search
- category search
- category API responses
- deterministic merchant insights
- existing merchant detection consuming Merchant Knowledge Service
- OpenAPI endpoint/schema coverage

Existing recommendation, checkout detection, intent, planning, wallet, benefit,
and validation tests continue to run under the full backend suite.

## Validation Results

Executed successfully:

```text
npm --prefix backend test -- --runInBand merchantKnowledgeRoutes.test.ts merchantIntelligenceService.test.ts merchantDetectionService.test.ts paymentDecisionV1Routes.test.ts
Test Suites: 4 passed, 4 total
Tests:       50 passed, 50 total
```

```text
npm test
Test Suites: 61 passed, 61 total
Tests:       455 passed, 455 total
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
mobile merchant knowledge syntax transpile check: passed
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

## Performance Considerations

The Merchant Knowledge MVP uses in-memory registry reads and deterministic
sorting/filtering. No database query or external network call is required for
lookup, search, categories, or insights.

Search is intentionally simple and bounded by request `limit` so it stays
predictable for private beta scale.

## Known Limitations

- Merchant analytics are deterministic fixture-backed values, not persisted
  user-level production aggregates.
- Mobile merchant detail is displayed inline in search results, not as a full
  merchant profile screen.
- Misspelling support is conservative and limited to short edit-distance
  matching.
- No AI search, OCR, cloud sync, authentication, billing, push notifications, or
  background location was added.

## Future Roadmap Integration

Merchant Knowledge can now be reused by:

- Smart Pay
- Planned Spending
- Wallet Coach
- Payment Journey
- Recurring Payments
- AI Coaching
- Receipt Intelligence
- partner APIs

Future enrichment should add new merchant metadata to the registry/service and
allow all downstream clients to benefit automatically.

## Final Status

EPIC-010 is complete for the intended MVP scope.

Merchant knowledge is centralized, searchable, API-accessible, mobile-visible,
and connected to existing merchant detection without changing recommendation
logic.
