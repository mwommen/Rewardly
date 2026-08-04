# Rewardly Public Payment Decision API

Status: Epic 001A hardened contract

## Run Locally

Backend with local Node:

```bash
cd backend
npm install
npm run dev
```

Sandbox mode without MongoDB:

```bash
cd backend
REWARDLY_SANDBOX_MODE=true REWARDLY_DISABLE_REQUEST_ANALYTICS=true npm run dev
```

Backend with Docker:

```bash
docker compose build --no-cache
docker compose up
```

Health check:

```bash
curl http://localhost:5001/health
```

Expected response:

```json
{ "status": "ok" }
```

## Create A Payment Decision

Endpoint:

```text
POST /api/v1/payment-decisions
```

Example:

```bash
curl -s http://localhost:5001/api/v1/payment-decisions \
  -H "Content-Type: application/json" \
  -d '{
    "merchant": {
      "name": "Amazon",
      "category": "online_retail"
    },
    "purchase": {
      "amount": 142.83,
      "currency": "USD"
    },
    "wallet": {
      "cards": [
        { "cardId": "amex_gold" },
        { "cardId": "chase_sapphire_preferred" }
      ]
    }
  }'
```

The API normalizes underscore card IDs to Rewardly's canonical slug format, then calls the existing `PaymentDecisionService` with `restrictToWallet: true`.

Validation rules:

- `merchant.name` is required and must be non-empty.
- `purchase.amount` is required and must be greater than zero.
- `purchase.currency` is required and currently supports only `USD`.
- `wallet.cards` is required. An empty array is valid and returns a deterministic `no_recommendation` response.
- Duplicate normalized card IDs are rejected.
- The V1 request model does not accept `preferences`.

Each successful request receives a request-scoped `decisionId` and uses that ID as the canonical service identity for the call. The public API does not use a shared `api-v1` user.

## OpenAPI

```bash
curl http://localhost:5001/api/v1/openapi.json
```

The OpenAPI document is colocated with the V1 route module so the implementation and public contract stay synchronized.

## Error Shape

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "merchant.name is required"
  }
}
```

## Scope Boundaries

This epic does not add authentication, API keys, billing, organizations, dashboards, analytics, or SDKs.

## Developer Resources

- Quick Start: `docs/GETTING_STARTED.md`
- Postman collection: `docs/postman/rewardly-public-api.postman_collection.json`
- Postman environment: `docs/postman/rewardly-local.postman_environment.json`
- Sample data: `docs/examples/sample-developer-data.json`
- OpenAPI: `GET /api/v1/openapi.json`
