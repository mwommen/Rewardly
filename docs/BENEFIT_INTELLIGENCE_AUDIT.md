# Rewardly Benefit Intelligence Audit

## Scope

Ticket #001 audited the existing benefit lifecycle and added the first trusted-data foundation for production recommendation quality. This does not solve live issuer benefit updates. It creates the schema, eligibility gate, audit command, and versioning interfaces required before a source-extraction pipeline can safely promote benefit changes.

## Current Architecture

Rewardly stores card and benefit data primarily in the MongoDB `cards` collection. The repository also contains TypeScript seed files, scraper adapters/parsers, validation scripts, route adapters, and test fixtures that create card-shaped benefit records.

Important locations:

- `backend/seedCards.ts`: primary local card catalog seed.
- `backend/demo/seedDemo.ts`: demo wallet/card state setup.
- `backend/src/models/benefits.ts`: legacy structured `BenefitsPayload` model.
- `backend/src/services/recommendationService.ts`: recommendation scoring and benefit matching.
- `backend/src/services/benefitIntelligenceService.ts`: canonical benefit adapter/model.
- `backend/src/services/benefitEligibilityService.ts`: central eligibility gate added by this ticket.
- `backend/src/services/benefitVersioningService.ts`: lightweight version/change foundation added by this ticket.
- `backend/src/scrapers/**`: issuer parsers and adapters that produce benefit-like structures.
- `backend/src/validateBenefitsQuality.ts` and `backend/src/validateBenefitsAccuracy.ts`: current quality checks.
- `backend/src/benefitsAudit.ts`: existing suspicious-benefit audit.

## Benefit Data Locations

| Location | Format | Usage | Risk |
| --- | --- | --- | --- |
| MongoDB `cards` | Card documents with top-level rewards/perks/credits and optional `benefitsDetail` | Runtime recommendation source | Multiple legacy shapes |
| `backend/seedCards.ts` | TypeScript array | Local/demo catalog | Partial verification metadata |
| Scraper output | `BenefitsPayload` plus top-level card fields | Catalog enrichment | Parser confidence varies |
| `backend/src/scrapers/overrides/cards.ts` | TypeScript overrides | Manual corrections | Can drift from canonical model |
| Tests | Inline card fixtures | Scoring/route tests | Often omit metadata intentionally |

## Data Flow Into Recommendation Engine

1. `PaymentDecisionService` receives checkout context and resolves the user wallet.
2. Wallet card slugs are passed into `recommendBestCards()` and `recommendAllBenefits()`.
3. `recommendationService` loads card documents from MongoDB.
4. Wallet filtering happens before scoring.
5. Legacy reward fields are scored for base/category reward fallback.
6. Merchant credits and special perk matches are canonicalized and passed through `isBenefitEligibleForRecommendation()`.
7. Expired, unverified, rejected, low-confidence, channel-incompatible, or non-production-approved special benefits cannot become exact-benefit matches.
8. Recommendation confidence receives matched canonical benefit metadata when present.

## Card Identity

Cards are identified primarily by `slug`. Some legacy fixtures fall back to `name` when `slug` is missing. This is acceptable for tests but should not be used for production catalog records.

Severity: Medium

Smallest fix: require `slug` in future canonical card migrations and audit cards without slugs.

## Benefit Categories

Categories currently exist in several forms:

- top-level `rewardsByCategory` object maps, for example `{ dining: 4 }`
- array entries with `keys`
- inferred categories from merchant/MCC helpers
- category synonyms inside `recommendationService`
- merchant intelligence categories

Severity: High

Smallest fix: migrate reward categories into canonical benefit records with constrained category values and source metadata. Keep existing synonyms as compatibility until migration completes.

## Merchant-Specific Benefits

Merchant credits currently use `merchantCredits[].eligibleWhen.merchantPatterns` plus label matching in `collectCreditMatches()`. This ticket adds canonical fields:

- `specificMerchant`
- `specificMerchantIds`
- `eligiblePurchaseChannels`
- `sourceUrl`
- `lastVerified`
- `productionEligible`

Severity: High

Smallest fix completed: exact merchant credits now pass through the central eligibility service before they can influence recommendation ranking.

## Statement Credits

Statement credits are represented as `merchantCredits` and `recurringCredits` with amount, period, cap, enrollment flag, and optional source URL.

New canonical support includes:

- `statementCredit.amountUSD`
- `statementCredit.period`
- `statementCredit.capPerPeriodUSD`
- `annualCredits`
- `spendingCap`
- `minimumSpend`
- `enrollmentRequired`
- `activationRequired`

Severity: Medium

Smallest fix completed: metadata is preserved during canonicalization and audited.

## Rotating And Time-Limited Benefits

Rotating rewards include `start`, `end`, and `activationRequired`. Merchant credits may include `expiresAt`.

Severity: Critical

Smallest fix completed: the eligibility service rejects benefits that are expired or not yet effective. Recommendation exact-benefit matching now uses that gate.

## Source And Verification Metadata

Before this ticket, source metadata existed inconsistently as `sourceUrl`, `lastScraped`, and confidence. It did not consistently distinguish observed, verified, and production-approved data.

New canonical metadata:

- `sourceUrl`
- `sourceType`
- `sourceTitle`
- `lastObservedAt`
- `lastVerified`
- `verificationStatus`
- `confidenceScore`
- `productionEligible`
- `version`
- `createdAt`
- `updatedAt`

Severity: Critical

Smallest fix completed: canonical records support these fields, the audit command reports missing metadata, and review items are documented.

## Hardcoded Logic Found

High:
- Reward category synonym maps in `recommendationService`.
- Broad category query suppression in `recommendationService`.
- Perk keep/discard keywords in `recommendationService`.
- Merchant inference from labels in `benefitIntelligenceService`.
- Merchant credit pattern matching in `merchantMatching`.

Medium:
- Issuer point valuation assumptions in `valuation`.
- Parser regexes in scraper adapters.
- Demo user/wallet setup in seed scripts.

Rules removed:
- No card-specific hardcoded rule was removed in this ticket because none was required to fix the eligibility foundation safely.

Rules now contained:
- Special-benefit eligibility checks were centralized in `benefitEligibilityService`.

Rules remaining and why:
- Category synonyms remain to preserve current recommendation behavior until categories are migrated.
- Perk cleanup heuristics remain to avoid showing scraper/nav junk.
- Merchant pattern matching remains as a compatibility adapter for current catalog fields.

## Duplicated Data Found

Benefit-like fields can exist both at top level and inside `benefitsDetail`. Scrapers may preserve existing top-level fields while adding `benefitsDetail`.

Severity: High

Smallest fix: use canonicalization as the adapter and add a later migration to persist canonical records in a dedicated collection.

## Accuracy Risks

Critical:
- Unsourced or unverified special benefits could previously influence recommendations.
- Expired credits could previously be matched if their merchant label still matched.

High:
- Category rewards can still be scored through legacy fields as a compatibility path.
- Current data does not prove every seeded reward was recently verified.

Medium:
- Merchant label matching can over-match similar merchant names.
- Some benefit limitations are plain text rather than structured.

## Freshness Risks

Critical:
- Missing `lastVerified` means Rewardly cannot prove current accuracy.

High:
- `lastScraped` is not equivalent to human/product approval.

Smallest fix completed:
- Canonical model separates `lastObservedAt` and `lastVerified`.
- Review queue flags missing verification timestamps.

## Missing Metadata

Common missing fields:

- source title
- last verified timestamp
- production eligibility
- purchase-channel restrictions
- geographic restrictions
- exclusions
- minimum spend
- structured limitations

See `docs/BENEFIT_REVIEW_QUEUE.md`.

## Recommendation Engine Integration

Completed:

- `recommendationService` canonicalizes card benefits.
- Exact merchant credits and special perk matches are filtered through `isBenefitEligibleForRecommendation()`.
- Expired or unapproved special benefits cannot create an exact-benefit match.
- Recommendation explanations continue to reference the benefit that actually won scoring.

Preserved:

- Existing fallback base/category reward scoring remains for compatibility.

Documented ambiguity:

- The current product still recommends a best general-purpose card when no special benefit exists. This appears intentional for the checkout experience, but future product policy should decide whether low-confidence base fallback should be suppressed for some flows.

## Migration Plan

Phase 1:
- Keep card-shaped source data.
- Canonicalize at runtime.
- Gate exact benefits centrally.
- Audit current dataset.

Phase 2:
- Persist canonical benefits in a `canonicalBenefits` collection.
- Persist benefit versions in a `benefitVersions` collection.
- Add an idempotent dry-run migration that reads `cards`, writes canonical records, and never deletes legacy fields.

Phase 3:
- Add official-source extraction jobs.
- Normalize extracted candidates into canonical records.
- Compare candidates against approved records.
- Put changed records into review.

Phase 4:
- Promote reviewed benefits to production.
- Require production-approved canonical benefits for all special-benefit scoring.
- Gradually migrate reward categories away from legacy fields.

Rollback:
- Keep legacy card fields intact.
- Disable canonical persisted reads and fall back to runtime canonicalization if needed.
- Never delete legacy data automatically.

## Severity Summary

Critical:
- Expired/unverified special benefits could influence recommendations. Fixed for exact benefit matches.
- Missing source/verification metadata. Schema and review queue added.

High:
- Multiple benefit shapes and duplicated source locations. Canonical adapter added.
- Category rewards still use legacy scoring. Documented compatibility path.

Medium:
- Card slugs not enforced everywhere.
- Limitations/exclusions are often unstructured.

Low:
- Some naming and source titles need cleanup.

## Remaining Blockers Before Live Benefit Updates

- No persisted canonical benefit collection yet.
- No persisted benefit version collection yet.
- No official-source extraction approval workflow.
- No human review tool.
- Not all category reward scoring is driven exclusively by canonical records.
- Seed/catalog data still needs issuer-by-issuer verification.
