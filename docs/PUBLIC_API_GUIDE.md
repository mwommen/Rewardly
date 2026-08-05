# Public API Guide

## Health

```bash
curl http://localhost:5001/health
```

## Public Payment Decision

```bash
curl -X POST http://localhost:5001/api/v1/payment-decisions \
  -H "Content-Type: application/json" \
  -d '{
    "merchant": { "name": "Amazon", "category": "online_retail" },
    "purchase": { "amount": 142.83, "currency": "USD" },
    "wallet": { "cards": [{ "cardId": "capital-one-venture" }] }
  }'
```

## Partner Payment Decision

```bash
curl -X POST http://localhost:5001/api/v1/partner/payment-decisions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer rw_test_your_key" \
  -H "X-Correlation-Id: corr_demo_001" \
  -d '{
    "merchant": { "name": "Amazon", "category": "online_retail" },
    "purchase": { "amount": 142.83, "currency": "USD" },
    "wallet": { "cards": [{ "cardId": "capital-one-venture" }] }
  }'
```

## Partner Response Metadata

Partner responses include:

```json
{
  "metadata": {
    "requestId": "req_...",
    "correlationId": "corr_demo_001",
    "organizationId": "org_...",
    "projectId": "prj_...",
    "environment": "sandbox"
  }
}
```

## Errors

Partner errors use:

```json
{
  "error": {
    "code": "PARTNER_AUTH_REQUIRED",
    "message": "A Rewardly API key is required.",
    "requestId": "req_...",
    "retryable": false
  }
}
```

Stack traces and secrets are not returned.
