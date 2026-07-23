# Merchant Intelligence Platform

Ticket 004 introduces a reusable merchant identity layer for Rewardly.

Rewardly should not rely on raw merchant strings such as `AMZN Mktp` or `APPLE.COM/BILL`. Those strings are resolved into canonical merchants with hierarchy, aliases, domains, billing descriptors, MCCs, categories, purchase context, and confidence.

## Merchant Model

Canonical merchants live in `backend/src/services/merchantIntelligenceService.ts`.

Each merchant supports:

- `merchantId`
- `displayName`
- `canonicalName`
- `merchantGroup`
- `parentCompany`
- `brand`
- `category`
- `subcategory`
- `categoryIds`
- `country`
- `region`
- `websiteDomains`
- `mobileAppIdentifiers`
- `knownAliases`
- `knownCheckoutDomains`
- `knownBillingDescriptors`
- `knownMccs`
- `mccProfile`
- `merchantType`
- `active`
- `createdAt`
- `updatedAt`
- `confidence`
- `notes`
- `relationships`

## Resolution Flow

`resolveMerchant()` accepts raw merchant data:

- merchant name
- billing descriptor
- hostname/domain/URL
- MCC
- country
- purchase channel

Resolution order:

1. Exact merchant ID
2. Known billing descriptor
3. Website or checkout domain
4. Known alias
5. MCC match
6. Category inference
7. Weak fuzzy match
8. Unknown

The result includes:

- canonical merchant
- confidence
- matching strategy
- alias used
- normalization steps
- inherited merchant tokens
- inherited category tokens
- purchase context flags

## Confidence Model

Current confidence levels:

- `100`: exact merchant ID
- `98`: known alias
- `95`: known billing descriptor
- `90`: known domain or checkout domain
- `75`: MCC or category inference
- `40`: weak fuzzy match
- `0`: unknown

Only stronger identity matches are allowed to raise recommendation confidence. Category inference and weak fuzzy matches do not silently create high-confidence recommendations.

## Hierarchy

Merchant relationships are explicit.

Example:

Amazon:

- Whole Foods Market
- Amazon Fresh
- Prime Video
- Audible

These relationships let Rewardly understand that Whole Foods is part of the Amazon group while still preserving grocery-category context.

Supported relationship types:

- parent
- child
- sibling
- brand
- subsidiary
- virtual brand
- future acquisition

## Category Inheritance

Categories are modeled as layered nodes.

Examples:

- `restaurant`
- `restaurant.delivery`
- `restaurant.coffee`
- `travel`
- `travel.airline`
- `travel.hotel`
- `retail`
- `retail.online`
- `retail.electronics`

Merchants can belong to multiple category nodes, and inherited category tokens are passed into recommendation matching.

## MCC Intelligence

Merchants support multiple MCCs through `knownMccs` and `mccProfile`.

The model supports:

- multiple MCCs
- issuer-specific overrides
- network-specific overrides
- historical changes
- exceptions

Rewardly does not assume one merchant always uses one MCC.

## Recommendation Matching

The recommendation service now resolves merchant identity once per request and uses:

- merchant ID
- merchant group
- parent company
- brand
- known aliases
- supported benefit mappings
- inherited categories
- MCC
- purchase channel
- confidence

Raw string matching remains only as a fallback.

## Developer Commands

Run from `backend/`:

```bash
npm run merchants:audit
npm run merchants:resolve -- "AMZN Mktp"
npm run merchants:aliases
npm run merchants:mcc
npm run merchants:confidence
```

## Resolution APIs

Existing intelligence routes expose:

- `GET /api/intelligence/merchants`
- `GET /api/intelligence/merchants/coverage`
- `GET /api/intelligence/merchants/audit`
- `GET /api/intelligence/merchants/aliases`
- `GET /api/intelligence/merchants/mcc`
- `GET /api/intelligence/merchants/resolve`

## Known Limitations

- Registry data is currently code-backed rather than persisted in a database.
- Real payment-network MCC enrichment is not connected yet.
- Issuer-specific MCC overrides are modeled but not populated broadly.
- Mobile app identifiers are stored but not used by browser checkout detection yet.
- Fuzzy matching is intentionally conservative.

## Future Merchant Onboarding

Adding a merchant should require data changes only:

1. Add canonical merchant registry entry.
2. Add aliases, domains, billing descriptors, MCCs, and category IDs.
3. Add hierarchy relationships if applicable.
4. Add regression tests for ambiguous aliases or MCCs.

Recommendation logic should not require merchant-specific branches.
