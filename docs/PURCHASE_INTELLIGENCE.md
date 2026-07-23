# Rewardly Purchase Intelligence Platform

Ticket #011 adds purchase understanding to Rewardly.

Rewardly already knows where a user is shopping. Purchase Intelligence helps it understand what the user is buying.

The recommendation engine remains the single scoring authority. Purchase Intelligence improves typed inputs and explanation context only.

## Architecture

The flow is:

`Checkout Page -> Merchant Checkout Adapter -> Canonical Purchase -> RecommendationPurchaseContext -> Payment Decision -> Recommendation Scoring`

The extension extracts lightweight checkout data when visible. The backend normalizes that data into a canonical `Purchase` model before passing it through `purchaseContext.purchase`.

`PaymentDecisionService` converts the purchase into a deterministic `RecommendationPurchaseContext` and passes it into both `recommendBestCards()` and `recommendAllBenefits()`. The recommendation service decides whether that context can safely refine scoring.

## Canonical Purchase Model

`Purchase` includes:

- `purchaseId`
- `merchantId`
- `subtotal`
- `tax`
- `shipping`
- `discounts`
- `total`
- `currency`
- `checkoutProvider`
- `confidence`
- `items`
- `categoryDistribution`
- `exclusions`
- `extractedAt`

`extractedAt` is generated at extraction time with `new Date().toISOString()`.

Each item includes:

- `itemId`
- `name`
- `quantity`
- `price`
- `category`
- `merchantCategory`
- `normalizedCategory`
- `recommendationCategory`
- `brand`
- `digitalOrPhysical`
- `exclusions`
- `confidence`

## Merchant Adapters

Initial adapters are beta scaffolds and merchant-agnostic from the scoring layer:

- Amazon
- Target
- Costco
- Best Buy
- Apple
- Nike
- Walmart
- Home Depot
- Lowe's
- Generic fallback

Adapters extract and normalize cart items and totals when visible. They do not make card recommendations. The current adapters are not a claim of complete real-site DOM coverage; real Amazon and merchant DOMs still require beta validation and selector refinement.

## Category Classification

Each item is classified into:

`Merchant category -> Normalized category -> Recommendation category`

Supported normalized categories include:

- electronics
- groceries
- gift card
- subscription
- digital goods
- travel
- restaurant
- fuel
- pharmacy
- home improvement
- apparel
- unknown

Confidence accompanies every item classification.

## Mixed Cart Processing

Mixed carts are represented through `categoryDistribution`.

Example:

- Laptop -> electronics
- Gift card -> gift card
- Groceries -> groceries
- Subscription -> subscription

The distribution includes item count, estimated category amount, and category share.

For recommendation scoring, a cart is materially mixed when any non-dominant category is at least `20%` of detected cart value, or when excluded categories are at least `5%` of detected cart value. Materially mixed carts do not reclassify the full purchase into one bonus category. Rewardly preserves merchant-level ranking and attaches a mixed-cart warning.

## Exclusions

Purchase Intelligence detects likely exclusions such as:

- gift cards
- cash equivalents
- subscriptions

Low-confidence or excluded purchases should not silently influence recommendations. Gift-card and cash-equivalent spend is excluded from estimated bonus-category value when detected.

## Confidence

Purchase confidence reflects:

- item extraction quality
- total/subtotal availability
- checkout provider detection
- item classification confidence
- warnings

Labels:

- high
- medium
- low
- unknown

Scoring gates:

- `high`: may refine categories when the cart is not materially mixed and has no detected exclusions.
- `medium`: may support evidence/explanation only when unambiguous; it does not change ranking by itself.
- `low` or `unknown`: does not change ranking and produces missing-information/evidence for explainability.
- materially mixed or excluded carts: preserve merchant-level ranking and produce structured warnings.

## Presentation Fields

Payment decisions and presentation models can expose:

- `purchaseSummary`
- `purchaseConfidence`
- `dominantCategory`
- `exclusionsSummary`
- `mixedCartWarning`

These fields are UI-ready summaries. Frontend surfaces should not re-derive scoring behavior from raw purchase items.

## Current Limitations

- Real merchant DOM extraction is intentionally conservative and still needs live beta validation.
- Mixed-cart scoring avoids invented blended rewards. It preserves merchant-level ranking and warns when the cart cannot be safely reduced to one category.
- Purchase intelligence can improve inputs, but it does not override wallet eligibility, benefit state, merchant matching, or recommendation scoring policy.

## Performance

Targets:

- Purchase extraction under `300ms`
- Category classification under `150ms`
- Total recommendation pipeline under `1000ms`

CLI and API reports include performance fields.

## CLI Commands

Run from `backend/`:

```bash
npm run purchase:test
npm run purchase:extract
npm run purchase:classify
npm run purchase:benchmark
npm run purchase:report
```

Optional fixture names:

- `amazon-electronics`
- `amazon-groceries`
- `amazon-gift-card`
- `apple`
- `best-buy-electronics`
- `target-groceries`
- `mixed`
- `unknown`

## API

Mounted under `/api`:

- `POST /purchase/extract`
- `POST /purchase/classify`
- `GET /purchase/report?fixture=mixed`

The payment decision endpoint also returns:

- `purchase`
- `purchasePerformance`

when purchase context is supplied.

## Known Limitations

- Browser extraction is intentionally lightweight and depends on visible checkout text.
- Real merchant DOMs may require adapter refinement over time.
- Purchase intelligence does not change recommendation rankings.
- No merchant-specific scoring was added.
- The model is prepared for web, extension, and future mobile clients.
