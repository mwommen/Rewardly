# Reliability Targets

## MVP Engineering Targets

- Decision API p95 latency under 500ms for cached catalog and typical wallet.
- Availability internal target 99.5 percent during design partner pilot.
- Error rate below 1 percent excluding invalid partner requests.
- Request body max 256KB initially.
- API timeout 3 seconds.
- Idempotent replay for duplicate decision requests.

## Public Promise

Do not publish enterprise SLA yet. Promise best-effort beta reliability with transparent status and support process.

## Degraded Behavior

- Merchant classification fails: return lower confidence or insufficient context.
- Analytics fails: do not block decision.
- Audit persistence fails: return decision if safe, emit alert.
- Card catalog unavailable: return service unavailable or cached data if validated.
- Explanation generation fails: fallback to winning-rule explanation.
- Optional integration fails: return warning, not inflated value.
