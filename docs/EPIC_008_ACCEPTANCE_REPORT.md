# EPIC-008 Acceptance Report: Planned Spending Intelligence Platform

## Summary

EPIC-008 introduces Planned Spending Intelligence as a backend-owned platform
capability. Users can create shopping plans, add planned purchases, optimize the
plan through the existing Payment Decision Engine, and mark planned purchases
complete from mobile.

Recommendation logic was not duplicated or changed. The Planning Engine calls
`PaymentDecisionService` for every planned purchase.

## Files Changed

- `backend/src/services/planningService.ts`
- `backend/src/routes/v1/planningRoutes.ts`
- `backend/src/routes/v1/paymentDecisionRoutes.ts`
- `backend/src/app.ts`
- `backend/tests/planningRoutes.test.ts`
- `mobile/src/types/planning.ts`
- `mobile/src/api/rewardly.ts`
- `mobile/src/hooks/usePlans.ts`
- `mobile/src/screens/PlanningScreen.tsx`
- `mobile/src/screens/PlanDetailScreen.tsx`
- `mobile/src/navigation/AppNavigator.tsx`
- `mobile/src/navigation/types.ts`
- `docs/PLANNED_SPENDING_INTELLIGENCE.md`
- `docs/MOBILE_SMART_PAY_ARCHITECTURE.md`
- `docs/API_OVERVIEW.md`
- `mobile/README.md`
- `docs/EPIC_008_ACCEPTANCE_REPORT.md`

## Planning Architecture

```text
Planning API
  -> Planning Engine
  -> PaymentDecisionService
  -> Benefit Registry / Merchant Intelligence / Wallet Intelligence
  -> Plan Optimization Response
  -> Mobile Planning Experience
```

The Planning Engine is implemented in `backend/src/services/planningService.ts`.
It stores plans in memory for this sprint and calls `decidePayment` once per
planned purchase during optimization.

## API Endpoints

Mounted under `/api/v1`:

- `POST /plans`
- `GET /plans`
- `GET /plans/{planId}`
- `PATCH /plans/{planId}`
- `DELETE /plans/{planId}`
- `POST /plans/{planId}/items`
- `PATCH /plans/{planId}/items/{itemId}`
- `POST /plans/{planId}/optimize`

Planning paths and schemas are included in:

- `GET /api/v1/openapi.json`

## Data Model

Core entities:

- Shopping Plan
- Planned Purchase
- Planned Merchant
- Planned Budget via `purchase.amount`
- Planning Summary via optimization response

Plans support:

- multiple merchants
- multiple purchases
- estimated spend
- notes
- completion state

## Optimization Flow

1. Client creates a shopping plan.
2. Client adds planned purchases.
3. Client sends wallet card IDs to `POST /api/v1/plans/{planId}/optimize`.
4. Planning Engine calls `PaymentDecisionService` for each planned purchase.
5. API returns best card per merchant, estimated total rewards, confidence,
   explanations, opportunity summary, and progress metrics.

## Payment Journey Integration

The mobile `PlanDetailScreen` lets users mark an optimized planned purchase
complete. That action:

1. Saves the optimized API decision into local Payment Journey.
2. Calls the Planning API to mark the plan item complete.

This keeps the Payment Journey as the record of completed payment decisions.

## Test Coverage

Added `backend/tests/planningRoutes.test.ts`, covering:

- plan creation
- plan listing
- planned purchase creation
- duplicate planned purchase prevention
- plan optimization
- merchant ordering
- progress tracking
- invalid plans
- empty plans
- missing plans
- deletion
- OpenAPI planning endpoint/model coverage

## Validation

Executed successfully:

```bash
npm --prefix backend test -- --runInBand planningRoutes.test.ts
```

Result:

- 1 test suite passed
- 7 tests passed

Executed successfully:

```bash
npm run build
```

Result:

- backend build passed
- shared core build passed
- frontend build passed

Executed successfully:

```bash
npm run extension:check
```

Result:

- extension JavaScript syntax checks passed

Executed successfully with local server binding enabled:

```bash
npm test
```

Result:

- 59 test suites passed
- 441 tests passed

Executed successfully:

```bash
node -e "...TypeScript transpile syntax check..."
```

Result:

- new mobile Planning TypeScript/TSX files parsed successfully

Attempted but blocked by missing mobile dependencies:

```bash
npm --prefix mobile run typecheck
```

Result:

- failed with `sh: tsc: command not found`
- `mobile/node_modules` is not installed in this workspace ZIP

Attempted but blocked by missing mobile dependencies:

```bash
npm --prefix mobile run lint
```

Result:

- failed with `sh: eslint: command not found`
- `mobile/node_modules` is not installed in this workspace ZIP

## Screenshots / GIFs

No runtime mobile screenshots were captured because Expo dependencies are not
installed in this workspace. Mobile planning files passed syntax transpile
checks, and backend/API behavior is covered by deterministic tests.

## Known Limitations

- Backend plan storage is in memory and resets when the process restarts.
- No authentication, cloud sync, shared plans, or database persistence was added.
- Mobile typecheck/lint require installing `mobile/node_modules`.
- Planned purchases use user-entered estimated amounts.
- No AI planning, OCR, receipt scanning, push notifications, or subscriptions
  were added.

## Future Roadmap

Recommended next steps:

1. Persist plans by authenticated user.
2. Add plan ownership and authorization.
3. Add database-backed plan history and sync.
4. Add partner-facing examples for budgeting/travel apps.
5. Add future AI planning only as a client of deterministic plan optimization.
