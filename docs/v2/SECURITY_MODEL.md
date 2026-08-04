# Security Model

## Controls

- API keys are opaque, random, hashed at rest, one-time displayed.
- All API requests require TLS.
- Tenant isolation by organization and environment.
- No full card numbers, CVVs, bank credentials, or payment execution.
- Rate limits by key/org/env.
- Request size limits.
- Input validation and stable errors.
- Log redaction for authorization, tokens, cookies, secrets, sensitive URLs.
- Separate test/live environments.
- Audit logging for key creation, revocation, decisions, and support access.
- Least-privilege production access.

## Threat Model

| Threat | Mitigation |
| --- | --- |
| Stolen API key | Hash storage, revocation, rate limits, last-used monitoring |
| Cross-tenant access | Mandatory org/env scoping and tests |
| Enumeration | Generic auth errors, rate limits |
| Injection | Schema validation, output encoding |
| Replay/idempotency abuse | Scoped idempotency keys and payload hashing |
| Log leakage | Redaction tests and no raw key logs |
| Excessive debug output | Trace gating by env/access |
| Malicious merchant input | Length limits and sanitization |
| Oversized requests | body limits |
| Invalid card slugs | reject with stable error |
| Dashboard session theft | secure cookies/session controls later |
| Test/live confusion | key prefixes and env labels |
| Internal abuse | audit support/admin actions |

Requires security review before live external beta.
