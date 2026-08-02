# Rewardly Architecture Overview

Rewardly is a wallet-first payment decision platform. The public API is a client-facing layer over the existing decision engine.

## Core Path

1. Client sends `POST /api/v1/payment-decisions`.
2. Express middleware parses JSON, applies security headers, and validates the request.
3. V1 route normalizes card IDs and creates a request-scoped public decision ID.
4. The route calls `PaymentDecisionService`.
5. The decision service resolves merchant, wallet, benefit, and purchase context.
6. Recommendation services score only wallet-owned cards.
7. Decision narrative and integrity validation produce evidence-based explanations.
8. The V1 response adapter returns the stable public response model.

## Source Of Truth

- Recommendation logic: `backend/src/services/paymentDecisionService.ts`
- Wallet resolution: `backend/src/services/walletService.ts`
- Benefit rules: Benefit Registry and card catalog data
- Merchant understanding: Merchant Intelligence services
- Public API contract: `backend/src/routes/v1/paymentDecisionRoutes.ts`

The public API does not duplicate recommendation logic.

## Runtime Entry Points

- `backend/src/app.ts`: Express app, middleware, routes, and error handling.
- `backend/src/server.ts`: environment validation, dependency startup, listener, graceful shutdown.

Importing `app.ts` does not start a listener.

## Sandbox Mode

`REWARDLY_SANDBOX_MODE=true` skips external database startup and uses existing catalog override data to hydrate cards. It is for developer evaluation only.
