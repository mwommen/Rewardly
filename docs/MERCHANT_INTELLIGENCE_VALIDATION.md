# Merchant Intelligence Validation

Run from `backend/`:

```bash
npm run validate:merchant-intelligence:curated
npm run validate:merchant-intelligence:generated -- --seed 20260724 --count 1000
npm run validate:merchant-intelligence:invariants
npm run validate:merchant-intelligence:metamorphic
npm run validate:merchant-intelligence:registry
npm run validate:merchant-intelligence:coverage -- --seed 20260724 --count 1000
npm run validate:merchant-intelligence:parity
npm run validate:merchant-intelligence:privacy
npm run validate:merchant-intelligence:performance -- --seed 20260724 --count 1000
npm run validate:merchant-intelligence:full -- --seed 20260724 --count 1000 --report
```

The framework validates:

- deterministic merchant resolution
- identity/context separation
- deceptive-domain rejection
- alias false-positive prevention
- checkout-provider separation
- merchant-family preservation
- confidence bounds
- input order stability
- redacted traces
- seeded generated scenarios
- registry quality
- semantic coverage
- shadow/parity comparison
- privacy redaction
- performance guardrails

Reports are written to:

- `docs/MERCHANT_INTELLIGENCE_REPORT.json`
- `docs/MERCHANT_INTELLIGENCE_REPORT.md`
- `docs/MERCHANT_INTELLIGENCE_PARITY_REPORT.json`
- `docs/MERCHANT_INTELLIGENCE_PARITY_REPORT.md`
- `docs/MERCHANT_INTELLIGENCE_PRIVACY_REPORT.json`
- `docs/MERCHANT_INTELLIGENCE_PERFORMANCE_REPORT.json`

Intentional failure checks:

```bash
npm run validate:merchant-intelligence -- --scenario does-not-exist
npm run validate:merchant-intelligence -- --suite generated --count 0
npm run validate:merchant-intelligence -- --seed invalid
```

All should exit nonzero with explicit validation messages.
