# Rewardly API Overview

## Base URL

Local:

```text
http://localhost:5001
```

## Health

```http
GET /health
```

Response:

```json
{ "status": "ok" }
```

## Create Payment Decision

```http
POST /api/v1/payment-decisions
```

Request:

```json
{
  "merchant": {
    "name": "Amazon",
    "category": "online_retail"
  },
  "purchase": {
    "amount": 142.83,
    "currency": "USD"
  },
  "wallet": {
    "cards": [{ "cardId": "capital-one-venture" }]
  }
}
```

Response:

```json
{
  "decisionId": "pdec_...",
  "status": "recommended",
  "recommendedPaymentMethod": {
    "cardId": "capital-one-venture",
    "displayName": "Capital One Venture Rewards"
  },
  "reason": "Highest verified earning rate among the eligible cards in your wallet.",
  "estimatedValue": 2.86,
  "currency": "USD",
  "confidence": 0.77,
  "explanation": {
    "summary": "Highest verified earning rate among the eligible cards in your wallet.",
    "factors": [
      "Earn 2x Venture Miles on this Amazon purchase.",
      "2x miles on every purchase"
    ]
  }
}
```

## Validation Rules

- `merchant.name` is required.
- `purchase.amount` is required and must be greater than zero.
- `purchase.currency` must be `USD`.
- `wallet.cards` is required.
- Duplicate card IDs are rejected after normalization.
- Unsupported fields are rejected.

## OpenAPI

```http
GET /api/v1/openapi.json
```

## Private-Beta Identity

Authenticated user data routes use a Bearer access token returned by signup or
signin.

```http
POST /api/v1/auth/signup
POST /api/v1/auth/signin
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET /api/v1/auth/session
DELETE /api/v1/me/account
```

Cloud-synced user data:

```http
GET /api/v1/me/wallet
PUT /api/v1/me/wallet
POST /api/v1/me/wallet/cards
DELETE /api/v1/me/wallet/cards/{cardId}
GET /api/v1/me/payment-journey
POST /api/v1/me/payment-journey
GET /api/v1/me/preferences
PUT /api/v1/me/preferences
POST /api/v1/me/migration/import
```

The server derives user identity from the token. Clients do not supply the
authoritative `userId` for `/api/v1/me/*` routes.

## Planned Spending

Authenticated Planned Spending Intelligence is exposed through user-scoped plan
endpoints:

```http
POST /api/v1/me/plans
GET /api/v1/me/plans
GET /api/v1/me/plans/{planId}
PATCH /api/v1/me/plans/{planId}
DELETE /api/v1/me/plans/{planId}
POST /api/v1/me/plans/{planId}/items
POST /api/v1/me/plans/{planId}/complete-item
POST /api/v1/me/plans/{planId}/optimize
```

Plan optimization calls the existing Payment Decision Engine for each planned
purchase. The API owns planning intelligence; mobile and future clients consume
the same endpoints.

## Financial Intent

Clients can submit user intent through:

```http
POST /api/v1/intents
GET /api/v1/intents/{intentId}
```

The Intent API routes to existing platform capabilities and returns a unified
response contract with `intentId`, `requestId`, `executedCapabilities`, `result`,
`warnings`, `errors`, and execution metadata.

Supported intent types:

- `SMART_PAY`
- `PLAN_PURCHASES`
- `COMPLETE_PURCHASE`
- `REVIEW_PAYMENT_HISTORY`
- `VIEW_WALLET_COACH`
- `VIEW_OPPORTUNITIES`
- `VIEW_WEEKLY_SUMMARY`

## Merchant Knowledge

Merchant Intelligence v2 is exposed through versioned merchant endpoints:

```http
GET /api/v1/merchants
GET /api/v1/merchants/{merchantId}
GET /api/v1/merchant-search
GET /api/v1/merchant-categories
GET /api/v1/merchant-insights
```

The Merchant Knowledge API returns structured merchant profiles including
aliases, category, MCCs, domains, parent company, brand, supported payment
methods, loyalty programs, tags, metadata, confidence, and last updated
timestamp.

Example search:

```http
GET /api/v1/merchant-search?q=amzn%20mktp
```

Example response:

```json
{
  "merchants": [
    {
      "merchantId": "amazon",
      "displayName": "Amazon",
      "category": "online_shopping",
      "parentCompany": "Amazon",
      "loyaltyPrograms": ["Amazon Prime"],
      "score": 0.94,
      "matchType": "alias"
    }
  ]
}
```

The mobile app consumes these endpoints for merchant search and detail display.
Merchant category, alias, loyalty, and metadata logic remains backend-owned.
