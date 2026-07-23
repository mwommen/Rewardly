# Rewardly Phase 4 Recommendation Intelligence Report

Date: 2026-07-22

## Executive Summary

Phase 4 adds the first durable intelligence foundation behind Rewardly's MVP. The user experience is unchanged. The recommendation flow still returns one card at checkout, but the backend now has structured benefit intelligence, merchant intelligence, internal confidence scoring, and internal inspection APIs that can support future admin tooling.

Recommendation: Ready for internal testing, not broad beta expansion yet.

Confidence: 84%

Reason: the intelligence layer is now test-covered and integrated, but benefit freshness still depends on the existing card data quality and does not yet include a full automated issuer update pipeline.

## 1. Benefit Intelligence Summary

Added a canonical benefit model in `backend/src/services/benefitIntelligenceService.ts`.

Canonical benefit records now include:

- card issuer
- card name
- benefit type
- merchant category
- specific merchant
- multiplier
- statement credit metadata
- annualized credit value
- travel/dining/shopping classifications
- redemption limitations
- exclusions
- effective date
- expiration date
- last verified timestamp
- verification source
- confidence score
- verification status
- source kind

Current source data can be canonicalized from:

- rewards by category
- flat rewards
- rotating rewards
- merchant credits
- recurring credits
- perks
- insurance benefits
- access benefits
- signup offers

The recommendation engine no longer needs to grow card-specific logic to understand benefit shape. New cards can be added by storing structured card data and letting the canonicalization layer produce benefit records.

## 2. Benefit Update Pipeline Design

A complete automated publishing pipeline was not built in this sprint, but the backend is now prepared for it.

Recommended pipeline:

1. Source collection
   - official issuer pages
   - issuer API data where available
   - structured scraper adapters
   - manual override records

2. Extraction
   - deterministic parser first
   - AI-assisted extraction only as an enrichment layer
   - extracted benefits converted into canonical benefit records

3. Version comparison
   - compare previous canonical records with latest extraction
   - detect added, removed, changed, expired, or confidence-dropped benefits

4. Review queue
   - high-confidence unchanged records can remain active
   - changed/low-confidence/stale records go to review
   - human approval required before publishing uncertain changes

5. Publication
   - approved benefits become active
   - historical versions retained for auditability

New support added:

- `GET /api/intelligence/benefits/canonical`
- `GET /api/intelligence/benefits/review-queue`

## 3. Merchant Intelligence Summary

Added `backend/src/services/merchantIntelligenceService.ts`.

Merchant intelligence records now support:

- official name
- aliases
- domains
- merchant category
- merchant network
- supported benefit mappings
- issuer naming differences
- checkout URL patterns
- payment page patterns
- normalization rules
- popup eligibility
- validation category

Amazon-specific handling now includes the foundation for:

- Amazon
- Amazon Marketplace
- Amazon Fresh
- Whole Foods

Important note:

The extension manifest is still intentionally scoped to Amazon, Lululemon, and local demo pages. The broader merchant intelligence registry supports future validation and expansion, but it does not enable popups on those merchants yet.

New support added:

- `GET /api/intelligence/merchants`
- `GET /api/intelligence/merchants/coverage`
- `GET /api/intelligence/merchants/resolve`

## 4. Recommendation Confidence

Added internal confidence scoring in `backend/src/services/recommendationConfidenceService.ts`.

Confidence factors:

- match quality
- merchant confidence
- benefit freshness
- wallet completeness

Confidence labels:

- high
- medium
- low

Low-confidence reasons:

- weak match quality
- uncertain merchant mapping
- benefit needs reverification
- limited wallet context

This confidence is not exposed in the user interface. It is carried internally in the payment decision payload and can be logged or reviewed through future admin tooling.

New support added:

- `POST /api/intelligence/confidence/score`

## 5. Recommendation Accuracy Report

Existing behavior preserved:

- wallet-first scoring remains intact
- empty wallet does not score the full catalog
- `restrictToWallet: true` only scores owned cards
- `restrictToWallet: false` can still support demo/search flows
- category, exact benefit, and base-rate scoring still work
- popup UI remains unchanged

Improved behavior:

- recommendations now receive merchant confidence from resolved merchant intelligence
- recommendation confidence now reflects freshness and match quality
- payment decisions preserve internal confidence metadata
- merchant intelligence improves canonical naming before scoring

## 6. Merchant Coverage Validation

Representative categories now exist in the merchant coverage matrix:

- travel
- airlines
- hotels
- restaurants
- grocery
- gas
- online retail
- electronics
- home improvement
- subscription services
- coffee
- pharmacies
- department stores

Every merchant in the coverage matrix reports:

- domains
- category
- popup eligibility
- checkout pattern availability
- payment pattern availability
- benefit mapping availability
- validation status

This is not yet a browser automation suite for every merchant. It is the data foundation needed to build that suite without hardcoding merchants into tests one by one.

## 7. Automated Testing Summary

Added tests:

- `backend/tests/benefitIntelligenceService.test.ts`
- `backend/tests/merchantIntelligenceService.test.ts`
- `backend/tests/recommendationConfidenceService.test.ts`

Updated tests:

- `backend/tests/paymentDecisionService.test.ts`

Validated:

- canonical benefit conversion
- benefit freshness scoring
- Amazon marketplace/family normalization
- representative merchant coverage categories
- high/low confidence scenarios
- payment decision confidence preservation
- existing wallet-first recommendation behavior

## 8. Architecture Improvements

New backend services:

- `benefitIntelligenceService`
- `merchantIntelligenceService`
- `recommendationConfidenceService`

New backend routes:

- `intelligenceRoutes`

Updated core types:

- `Recommendation.confidence`

Updated backend integration:

- `merchantDetectionService` now consults merchant intelligence
- `recommendationService` now computes internal intelligence confidence
- `paymentDecisionService` passes merchant confidence into scoring and preserves recommendation confidence

## 9. Remaining Technical Debt

High:

- Merchant registry still exists in multiple places: extension content script, shared core, and backend intelligence registry.
- Benefit update pipeline is designed but not fully automated.
- Benefit version history is not persisted yet.
- Review queue is generated live from current card data, not stored as workflow state.

Medium:

- Confidence scoring is deterministic but not calibrated against real user outcomes yet.
- Canonical benefits are derived from existing data shape; source data quality remains the limiting factor.
- Issuer naming differences are represented but not deeply used in scoring yet.
- Merchant-specific sub-brand handling needs line-item or checkout context before resolving Whole Foods/Amazon Fresh perfectly.

Low:

- Internal APIs are unprotected in local/dev mode and should be gated before hosted deployment.
- Admin tooling is API-only; no internal UI exists yet.
- Confidence reason labels should eventually be documented as a stable enum.

## 10. Biggest Risks Before Beta

1. Outdated benefit data
   - Risk: Rewardly may recommend a card for a benefit that changed.
   - Mitigation: use review queue, last verified timestamps, and benefit freshness confidence.

2. Merchant ambiguity
   - Risk: large platforms like Amazon can represent many purchase types.
   - Mitigation: merchant intelligence now supports networks/sub-brands, but richer purchase context is still needed.

3. Registry drift
   - Risk: extension/shared/backend merchant registries can diverge.
   - Mitigation: next architecture step should generate extension registry from shared source.

4. Confidence not operationalized
   - Risk: low-confidence recommendations may occur without internal review.
   - Mitigation: analytics and internal confidence metadata exist; dashboarding is next.

## 11. Internal Testing Recommendation

Rewardly is ready for internal testing of the intelligence layer.

Recommended internal test plan:

1. Load canonical benefit records for current cards.
2. Review stale/low-confidence benefits.
3. Run Amazon and Lululemon checkout harnesses.
4. Inspect decision confidence for each recommendation.
5. Test wallets with one card, multiple cards, and no matching benefit.
6. Validate merchant coverage matrix before enabling any new merchant in the extension manifest.

Do not expand public merchant support until:

- registry duplication is removed or generation is automated
- at least one real checkout smoke test exists per enabled merchant
- benefit review workflow persists review state
