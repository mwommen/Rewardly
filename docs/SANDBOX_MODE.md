# Sandbox Mode

Sandbox mode lets partners test Rewardly without live customer data.

## Project Environment

Create a project with:

```json
{
  "environment": "sandbox"
}
```

API keys for sandbox projects use the `rw_test_` prefix.

## Decision Requests

Sandbox partner requests use:

```http
POST /api/v1/partner/payment-decisions
Authorization: Bearer rw_test_...
```

The request body follows the same stable V1 payment decision contract.

## Recommendation Logic

Sandbox mode does not use a separate recommendation engine. It routes through
the same PaymentDecisionService and Benefit Registry as live requests.

## Limits

Sandbox requests use lower default rate limits than live traffic. Defaults can
be configured with:

```text
REWARDLY_PARTNER_RATE_LIMIT_SANDBOX_COUNT
REWARDLY_PARTNER_RATE_LIMIT_SANDBOX_WINDOW_MS
```
