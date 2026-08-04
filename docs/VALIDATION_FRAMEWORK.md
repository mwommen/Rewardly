# Validation Framework

Rewardly uses deterministic tests and curated validation scenarios to protect recommendation correctness.

## Main Commands

```bash
npm --prefix backend test -- --runInBand
npm --prefix backend run validate:recommendations:curated
npm run shared:build
npm run extension:check
```

## What Is Covered

- Wallet-only recommendation behavior.
- Merchant, category, and base earning rules.
- Statement credits and benefit state.
- Unknown and ambiguous merchant cases.
- Recommendation narrative integrity.
- Checkout detection fixtures.
- Public V1 API validation and response shape.

## Reports

Validation reports live under `docs/` and backend validation output directories. Generated validation artifacts should not be committed unless they are intentional release evidence.
