# EPIC-001A Acceptance Report

Status: Complete except Docker runtime verification blocked by missing local Docker CLI.

Date: 2026-07-30

## Summary

EPIC-001A hardened Rewardly's public V1 Payment Decision API around the existing canonical decision engine. The API path now exercises:

HTTP request -> Express app middleware -> `/api/v1/payment-decisions` -> `PaymentDecisionService` -> public V1 response adapter.

No recommendation logic was duplicated or rewritten.

## Files Changed

- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/routes/v1/paymentDecisionRoutes.ts`
- `backend/tests/paymentDecisionV1Routes.test.ts`
- `backend/tests/paymentDecisionV1App.test.ts`
- `docs/PUBLIC_PAYMENT_DECISION_API.md`
- `docs/EPIC_001A_ACCEPTANCE_REPORT.md`

The repository also contains pre-existing uncommitted EPIC-001/private-beta files. They were not reverted.

## Architecture

- `backend/src/app.ts` now owns Express app construction, middleware, health endpoints, route mounting, and error handling.
- `backend/src/server.ts` now only validates runtime environment, connects dependencies, and starts the listener.
- Importing `app` does not start the HTTP listener or connect MongoDB.
- `/health` returns `{ "status": "ok" }` for monitoring.
- `/api/v1/payment-decisions` is mounted through the full Express app under `/api/v1`.

## V1 Request Contract

Required:

- `merchant.name`: non-empty string.
- `purchase.amount`: finite number greater than zero.
- `purchase.currency`: `USD`.
- `wallet.cards`: array, max 30 cards.
- `wallet.cards[].cardId`: non-empty string, max 80 characters.

Rejected:

- Missing amount.
- Zero or negative amount.
- Missing currency.
- Non-USD currency with `422 UNSUPPORTED_PURCHASE`.
- Duplicate normalized card IDs.
- Unsupported fields, including the removed `preferences` object.
- Malformed object/array shapes.
- Oversized request payloads.
- Malformed JSON.

Empty wallet is valid and deterministic. It calls the engine with `restrictToWallet: true` and an empty `manualCardSlugs` array.

The public V1 request model no longer includes `preferences`.

## Response Contract

Successful responses guarantee:

- `decisionId`: public `pdec_<uuid>` string unless the canonical decision already supplies a public `pdec_` ID.
- `status`: `recommended` or `no_recommendation`.
- `recommendedPaymentMethod`: object or `null`.
- `reason`: non-empty string.
- `estimatedValue`: finite number or `null`.
- `currency`: `USD`.
- `confidence`: finite number clamped to `0..1`.
- `explanation.summary`: non-empty string.
- `explanation.factors`: string array.

Error responses use:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "merchant.name is required"
  }
}
```

Stack traces and internal exception messages are not exposed.

## Identity And Wallet Safety

- The API no longer uses a shared `api-v1` user.
- Each successful request gets a request-scoped public decision ID.
- That public decision ID is passed into `PaymentDecisionService` as the request identity.
- `restrictToWallet: true` is always passed.
- The supplied wallet cards are normalized and passed as `manualCardSlugs`.
- Tests verify supplied wallet cards are the sole eligible wallet input.

## Purchase Context

The V1 API passes amount/currency/checkout context to the engine. It does not fabricate a canonical `Purchase` object from incomplete public API input. This avoids invalid purchase intelligence assumptions while preserving deterministic payment decisions.

## OpenAPI

OpenAPI is colocated in `backend/src/routes/v1/paymentDecisionRoutes.ts` and exposed at:

```text
GET /api/v1/openapi.json
```

The document reflects:

- Required positive amount.
- USD-only currency.
- No `preferences`.
- Empty wallet example.
- Duplicate/invalid request handling through structured errors.
- `400`, `422`, `429`, and `500` responses.

## Curl Verification

Temporary app-only server:

```bash
REWARDLY_DISABLE_REQUEST_ANALYTICS=true NODE_ENV=test node -e "const app=require('./backend/dist/backend/src/app.js').default; const server=app.listen(5099,'127.0.0.1',()=>console.log('rewardly-test-server-ready http://127.0.0.1:5099')); process.on('SIGTERM',()=>server.close(()=>process.exit(0))); process.on('SIGINT',()=>server.close(()=>process.exit(0)));"
```

Health:

```bash
curl -i http://127.0.0.1:5099/health
```

Result: `HTTP/1.1 200 OK`

```json
{"status":"ok"}
```

Valid V1 decision:

```bash
curl -i -X POST http://127.0.0.1:5099/api/v1/payment-decisions \
  -H 'Content-Type: application/json' \
  -d '{"merchant":{"name":"Amazon","category":"online_retail"},"purchase":{"amount":142.83,"currency":"USD"},"wallet":{"cards":[{"cardId":"capital_one_venture"}]}}'
```

Result: `HTTP/1.1 200 OK`

```json
{
  "decisionId": "pdec_bd375847-80e4-48c9-98a5-c8c3e2144b40",
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

Invalid V1 decision:

```bash
curl -i -X POST http://127.0.0.1:5099/api/v1/payment-decisions \
  -H 'Content-Type: application/json' \
  -d '{"merchant":{"name":"Amazon"},"purchase":{"currency":"USD"},"wallet":{"cards":[]}}'
```

Result: `HTTP/1.1 400 Bad Request`

```json
{"error":{"code":"INVALID_REQUEST","message":"purchase.amount is required"}}
```

## Validation Results

Passed:

- `npm --prefix backend run build`
- `npm --prefix backend test -- --runInBand`
  - 54 test suites passed.
  - 414 tests passed.
- `npm --prefix backend test -- --runInBand paymentDecisionV1Routes paymentDecisionV1App`
  - 2 test suites passed.
  - 23 tests passed.
- `npm --prefix backend run validate:recommendations:curated`
  - 104/104 scenarios passed.
- `npm run shared:build`
- `npm run extension:check`
- `npm run frontend:build`
- Direct curl verification against `/health`.
- Direct curl verification against `/api/v1/payment-decisions`.

Blocked:

- `docker compose build --no-cache`
  - Result: `zsh:1: command not found: docker`

Docker cannot be verified from this machine until Docker Desktop or an equivalent Docker CLI is installed and available on `PATH`.

## Docker Commands To Run On A Docker-Enabled Machine

```bash
docker compose build --no-cache
docker compose up -d
docker compose ps
curl -i http://localhost:5001/health
curl -i -X POST http://localhost:5001/api/v1/payment-decisions \
  -H 'Content-Type: application/json' \
  -d '{"merchant":{"name":"Amazon","category":"online_retail"},"purchase":{"amount":142.83,"currency":"USD"},"wallet":{"cards":[{"cardId":"capital_one_venture"}]}}'
```

## Limitations

- Authentication, API keys, billing, organizations, dashboards, analytics products, and SDKs are intentionally out of scope.
- The V1 API currently supports only USD purchases.
- Docker verification is still pending on a Docker-enabled machine.
- The public request model is intentionally small and does not yet accept rich purchase itemization.

## Acceptance Notes

The API is ready for developer-level V1 testing through local Node. Docker packaging exists, but Docker runtime acceptance remains unverified in this environment because Docker is not installed.
