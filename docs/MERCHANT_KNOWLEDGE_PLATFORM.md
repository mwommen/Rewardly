# Merchant Knowledge Platform

Merchant Knowledge Platform v2 turns Rewardly merchant data into a reusable
backend capability. Merchants are represented as structured entities rather
than raw strings, and every client consumes merchant knowledge through APIs.

## Architecture

```text
Merchant Intelligence Registry
  -> Merchant Knowledge Service
     -> Merchant lookup
     -> Alias resolution
     -> Category lookup
     -> Merchant search
     -> Metadata retrieval
     -> Merchant insights
  -> V1 Merchant APIs
  -> Mobile App / Partner APIs
```

Existing engines continue to use the same deterministic registry and resolver.
The mobile app does not own merchant category, alias, loyalty, or metadata
logic.

## Merchant Domain

Merchant profiles include:

- merchant ID
- canonical name
- display name
- aliases
- merchant category
- category code where available
- brand
- parent company
- country
- region
- website domains
- checkout domains
- billing descriptors
- MCCs
- supported payment methods
- loyalty programs
- merchant tags
- metadata
- active state
- confidence
- last updated timestamp

The underlying registry also preserves hierarchy, category inheritance, MCC
profiles, checkout signals, payment-page patterns, and supported benefit
mappings.

## Knowledge Service

`MerchantKnowledgeService` exposes:

- `listMerchantProfiles()`
- `getMerchantProfile()`
- `resolveMerchantKnowledge()`
- `searchMerchantProfiles()`
- `listMerchantCategories()`
- `getMerchantInsight()`
- `buildMerchantKnowledgeSummary()`

The existing `merchantDetectionService` now resolves through
`resolveMerchantKnowledge()`, so decision paths benefit from the same centralized
merchant knowledge.

## APIs

```http
GET /api/v1/merchants
GET /api/v1/merchants/{merchantId}
GET /api/v1/merchant-search
GET /api/v1/merchant-categories
GET /api/v1/merchant-insights
```

`GET /api/v1/openapi.json` includes these endpoints and schemas.

## Search Behavior

Search is deterministic and supports:

- exact merchant name
- aliases
- domains
- brand matching
- category matching
- partial matches
- common misspellings within a small edit-distance window
- optional category/country filtering

Search does not use AI or external services.

## Merchant Insights

The MVP exposes deterministic merchant insight fields:

- Payment Journey entry count
- most used card
- estimated rewards earned
- average purchase amount
- planned spending entry count

Current values are deterministic fixture-backed platform data. Future versions
can replace the fixture source with persisted user or tenant aggregates without
changing the API shape.

## Mobile Integration

The mobile Merchant Search screen calls the Merchant Knowledge APIs and displays
backend-provided merchant details, including category, parent company, and
loyalty programs. Local suggestions remain only as a fallback when the API is
unavailable.

## Boundaries

Not included:

- AI search
- OCR
- cloud synchronization
- push notifications
- background location
- authentication
- billing

## Known Limitations

- Merchant analytics are deterministic MVP fixtures, not persisted production
  aggregates.
- Mobile merchant detail is shown inline in search rows rather than a dedicated
  merchant profile screen.
- Search misspelling support is intentionally conservative to avoid surprising
  matches.
