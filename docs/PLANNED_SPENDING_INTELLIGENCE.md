# Planned Spending Intelligence

Planned Spending Intelligence lets Rewardly optimize purchases before they
happen. It answers a different question than Smart Pay:

- Smart Pay: What card should I use right now?
- Planning: How should I prepare for what I am about to spend?

The capability is platform-first. The backend owns planning logic and the mobile
app is only one client.

## Architecture

```text
Planning API
  -> Planning Engine
  -> PaymentDecisionService
  -> Benefit Registry / Merchant Intelligence / Wallet Intelligence
  -> Plan Optimization Response
  -> Mobile Planning Experience
```

The Planning Engine never duplicates recommendation logic. Each planned purchase
is optimized by calling the existing `PaymentDecisionService` with the merchant,
estimated amount, and wallet card IDs supplied to the V1 API.

## Domain Model

### Shopping Plan

A shopping plan groups future spending into a single optimization context.

Fields:

- `planId`
- `title`
- `notes`
- `status`
- `currency`
- `items`
- `createdAt`
- `updatedAt`

### Planned Purchase

A planned purchase is one future payment decision.

Fields:

- `itemId`
- `merchant`
- `purchase`
- `notes`
- `completionState`
- `completedAt`
- `completedDecisionId`
- `createdAt`
- `updatedAt`

### Planning Summary

Optimization returns:

- estimated total rewards
- best card per planned merchant
- opportunity summary
- planned/completed/remaining counts
- estimated rewards earned
- estimated rewards remaining

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

Planning schemas and examples are included in:

- `GET /api/v1/openapi.json`

## Optimization Flow

1. Client creates a plan.
2. Client adds one or more planned purchases.
3. Client calls `POST /api/v1/plans/{planId}/optimize` with wallet card IDs.
4. Planning Engine calls `PaymentDecisionService` for each planned purchase.
5. API returns best card, estimated value, explanation, confidence, and plan
   totals.

## Mobile Flow

The mobile app adds:

- Planning tab
- plan creation
- planned purchase entry
- optimized plan summary
- best card per merchant
- mark-complete action

When a planned purchase is marked complete, the mobile app saves the optimized
decision into Payment Journey and then marks the planned item complete through
the Planning API.

## Persistence

This epic uses an in-memory backend store. That keeps the platform API and
planning behavior testable without adding authentication, database migrations, or
cloud sync.

Future production persistence should store plans by authenticated user and keep
`planId`, `itemId`, and `decisionId` stable for sync.

## Known Limitations

- No authentication or cloud sync was added in this epic.
- Plan storage is in memory and resets when the backend restarts.
- Planned spending uses estimated amounts supplied by the user.
- No AI planning, receipt OCR, shared plans, subscriptions, or notifications were
  added.
