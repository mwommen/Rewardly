# Rewardly Issuer Intelligence Platform

Ticket #008 creates the architecture for multi-issuer benefit ingestion without moving issuer-specific logic into recommendations.

## Architecture

Every issuer follows the same path:

`Issuer -> Source -> Extraction -> Normalization -> Review -> Promotion -> Recommendation`

The recommendation engine consumes canonical cards and canonical benefits. It should not know whether a benefit came from American Express, Chase, Capital One, or a future issuer.

## Canonical Issuer Model

`CanonicalIssuer` is the registry record for an issuer integration.

It includes:

- `issuerId`
- `displayName`
- `aliases`
- `branding`
- `country`
- `supportedProducts`
- `parserVersion`
- `sourceRegistry`
- `extractionCapabilities`
- `normalizationCapabilities`
- `reviewStatus`
- `confidenceProfile`

Review status lets Rewardly distinguish the current American Express pilot from sandbox issuers that are architecturally modeled but not production integrations.

## Issuer Adapter

Each issuer adapter implements one contract:

- `discoverSources()`
- `extractBenefits()`
- `normalizeBenefits()`
- `validateBenefits()`
- `compareChanges()`
- `estimateConfidence()`

Adding an issuer should mean adding an adapter and registry data, not changing recommendation scoring.

## Issuer Registry

`ISSUER_REGISTRY` is the single source of truth for issuer metadata, capabilities, parser versions, and readiness. The registry can report:

- enabled or disabled status
- parser version
- supported products
- extraction capabilities
- parser/source health
- issuer statistics

## Product Catalog

`PRODUCT_CATALOG` models cards across issuers with:

- issuer
- product ID
- display name
- network
- annual fee
- reward currency
- benefit groups
- travel partners
- status
- version
- aliases

The initial catalog includes American Express pilot products plus sandbox entries for Chase, Capital One, Citi, Discover, and Bilt.

## Mapping Engine

Issuers describe the same benefit in different words. The mapping engine converts examples like these into canonical benefits:

- `Dining Credit`
- `Restaurant Credit`
- `Food Credit`
- `Monthly Dining Benefit`

All map to `Dining Credit`.

The mapper returns:

- canonical benefit name
- canonical benefit type
- source kind
- confidence
- matching strategy

## Health Monitoring

Issuer health reports track:

- extraction success
- normalization success
- validation success
- promotion success
- rejected benefits
- parser errors
- source failures
- confidence trend
- parser health

Parser failures or broken source structure should produce `review_required` instead of silently producing bad recommendation data.

## Source Change Detection

`detectIssuerSourceChange()` detects:

- checksum drift
- missing expected sections
- unexpectedly short source payloads

This is the first guardrail for issuer webpage redesigns or parser breakage.

## Issuer Sandbox

The sandbox supports fixture products for:

- Amex Gold
- Amex Platinum
- Chase Sapphire Preferred
- Chase Sapphire Reserve
- Freedom Unlimited
- Capital One Venture X
- Citi Strata Premier
- Discover It
- Bilt Mastercard

Sandbox fixtures validate adapters before live issuer work begins.

## CLI Commands

Run from `backend/`:

```bash
npm run issuer:list
npm run issuer:health
npm run issuer:test
npm run issuer:compare
npm run issuer:validate
npm run issuer:catalog
npm run issuer:registry
```

The CLI returns structured JSON reports for engineering review.

## Future Issuer Checklist

1. Add canonical issuer registry data.
2. Add product catalog entries.
3. Add official source records.
4. Implement an issuer adapter.
5. Add sandbox fixtures.
6. Verify extraction and normalization.
7. Run source-change detection.
8. Run health report.
9. Send candidates through review and promotion.
10. Confirm recommendations consume only canonical promoted data.

## Known Limitations

- Chase, Capital One, Citi, Discover, Bank of America, US Bank, Wells Fargo, and Bilt are modeled as sandbox integrations only.
- No live issuer synchronization is implemented.
- No recommendation scoring changes were made.
- The American Express pilot remains backward compatible and continues to use the existing benefit pipeline.
