# Observability

## Required Fields

Request ID, organization ID, environment, endpoint, status, latency, error category, confidence level, unknown merchant/card flags, no-decision flag, engine version, rule version, decision volume, retry/rate-limit events.

## Do Not Log

API keys, full authorization headers, raw sensitive wallet payloads, unnecessary user identity, full URLs with sensitive query parameters, card numbers, cookies, tokens.

## Metrics

- Decision success rate.
- Low-confidence rate.
- Unknown merchant rate.
- Unknown card rate.
- No-decision rate.
- p50/p95/p99 latency.
- Error count by code.
- Usage by org/env.
- Idempotency replay count.

## Alerts

High 5xx rate, auth failure spike, unknown-card spike, unknown-merchant spike, audit persistence failures, latency above target, package/validation failures.
