# Rewardly Getting Started

Goal: make your first successful Payment Decision API request in under five minutes.

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop, only if running with Docker

## Install

```bash
npm --prefix backend install
npm --prefix frontend-vite install
```

## Fastest Path: Local Sandbox

Sandbox mode runs without MongoDB and uses predefined Rewardly card data. It still calls the canonical `PaymentDecisionService`.

```bash
cd backend
REWARDLY_SANDBOX_MODE=true REWARDLY_DISABLE_REQUEST_ANALYTICS=true npm run dev
```

Health check:

```bash
curl http://localhost:5001/health
```

Payment decision:

```bash
curl -X POST http://localhost:5001/api/v1/payment-decisions \
  -H "Content-Type: application/json" \
  -d '{"merchant":{"name":"Amazon","category":"online_retail"},"purchase":{"amount":142.83,"currency":"USD"},"wallet":{"cards":[{"cardId":"capital-one-venture"}]}}'
```

Expected result: `status` is `recommended` and `recommendedPaymentMethod.cardId` is `capital-one-venture`.

## Run With Docker

```bash
docker compose build --no-cache
docker compose up
```

Then run the same health and payment-decision curl commands above.

## Environment Variables

Required for production mode:

- `NODE_ENV=production`
- `PORT=5001`
- `MONGO_URI`
- `FRONTEND_ORIGIN`
- `EXTENSION_ORIGIN`

Useful for local evaluation:

- `REWARDLY_SANDBOX_MODE=true`
- `REWARDLY_DISABLE_REQUEST_ANALYTICS=true`
- `REWARDLY_MERCHANT_INTELLIGENCE_MODE=merchant-intelligence`

## Postman

Import:

- `docs/postman/rewardly-public-api.postman_collection.json`
- `docs/postman/rewardly-local.postman_environment.json`

Select the `Rewardly Local` environment and run `Health check`, then `Successful payment decision`.

## Common Errors

- `purchase.amount is required`: include a positive number in `purchase.amount`.
- `purchase.currency must be USD`: V1 currently supports USD only.
- `Rewardly could not create a payment decision`: confirm sandbox mode or Mongo is configured and the wallet card ID exists.
- Docker command not found: install Docker Desktop and restart your shell.

## Next Steps

- Read `docs/API_OVERVIEW.md`.
- Inspect examples in `docs/examples/sample-developer-data.json`.
- Review architecture in `docs/ARCHITECTURE_OVERVIEW.md`.
