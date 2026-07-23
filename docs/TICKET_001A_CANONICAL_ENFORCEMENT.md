# Rewardly Ticket 001A: Complete Canonical Benefit Enforcement

## Summary

Ticket 001A closes the trust gap left after Ticket 001. Production recommendation scoring now routes flat rewards, category rewards, rotating rewards, merchant credits, recurring credits, and ranking-relevant perks through canonical benefit records and `isBenefitEligibleForRecommendation()`.

No UI was changed.

## Scoring Paths Changed

Changed in `backend/src/services/recommendationService.ts`:

- Removed strict-production scoring dependence on direct `rewardsFlat` loops.
- Removed strict-production scoring dependence on direct `rewardsByCategory` loops.
- Removed strict-production scoring dependence on direct `rewardsRotating` loops.
- Replaced those paths with `canonicalizeCardBenefits()` output filtered through `isBenefitEligibleForRecommendation()`.
- Exact merchant credits and recurring credits are matched from eligible canonical benefits.
- Strict production output uses the matched canonical benefit for:
  - `matchedBenefit`
  - `matchedBenefitId`
  - `lastVerified`
  - `sourceUrl`
  - explanation text

Compatibility mode remains explicit for legacy migration/testing behavior.

## Production Policy

Scoring mode is now explicit:

- `strict_production`
- `compatibility`

Production-facing paths explicitly use `strict_production`:

- `PaymentDecisionService`
- `/api/recommendations/best`
- `/api/recommendations/offers`

Compatibility mode is used in legacy tests and migration scenarios only.

## Proof Of Canonical Enforcement

In strict production mode, a card reward or benefit can influence ranking only after:

1. legacy card data is converted into a `CanonicalBenefitRecord`
2. the benefit passes `isBenefitEligibleForRecommendation()`
3. the recommendation service scores the canonical benefit, not the raw legacy field

Automated tests prove:

- unverified flat rewards cannot win
- unverified category rewards cannot win
- unverified rotating rewards cannot win
- verified canonical category rewards can win
- observed-only scraped benefits remain ineligible
- expired benefits cannot produce exact matches
- unapproved benefits cannot produce exact matches

## Updated Eligibility Reason Codes

Added:

- `BENEFIT_ENROLLMENT_REQUIRED`
- `BENEFIT_ACTIVATION_REQUIRED`
- `BENEFIT_USER_STATUS_UNKNOWN`

Existing:

- `BENEFIT_EXPIRED`
- `BENEFIT_NOT_EFFECTIVE`
- `BENEFIT_REJECTED`
- `BENEFIT_UNVERIFIED`
- `BENEFIT_NOT_PRODUCTION_ELIGIBLE`
- `BENEFIT_CONFIDENCE_TOO_LOW`
- `BENEFIT_MISSING_MATCHING_INFORMATION`
- `BENEFIT_PURCHASE_CHANNEL_INCOMPATIBLE`
- `BENEFIT_RESTRICTION_INCOMPATIBLE`

## Observed Vs. Verified

Canonicalization no longer treats scraper timestamps as verification.

- `lastObservedAt` may use `lastScraped`, scraper output, or database update timestamps.
- `lastVerified` only uses explicit `lastVerified` metadata.
- Recently scraped benefits are still unverified unless approved.

## Audit Output Updates

`npm run audit:benefits` now reports:

- `observedButUnverifiedBenefits`
- `legacyRewardsBlockedByStrictEligibility`
- `enrollmentRequiredBenefitsMissingUserState`
- `activationRequiredBenefitsMissingUserState`
- `productionEligibleMissingExplicitLastVerified`
- `recordsWhereVerifiedEqualsObservedTimestamp`
- `productionScoringBypassCount`

`productionScoringBypassCount` is currently `0` because strict production scoring no longer reads raw reward fields directly.

## Remaining Migration-Only Legacy Paths

The following remain intentionally for compatibility, admin, or migration support:

- scraper parsers still emit legacy card-shaped fields
- card routes and wallet summary use legacy reward fields for non-checkout support views
- compatibility scoring mode supports old fixtures and migration validation
- raw card perks can still be displayed in compatibility mode

These paths are not the strict production checkout recommendation path.

## Launch Blockers Around User State

Enrollment and activation state is still incomplete.

Current behavior:

- if a strict-production benefit requires enrollment and the canonical benefit ID is known enrolled, it can score
- if known not enrolled, it is rejected
- if unknown, it is rejected with `BENEFIT_USER_STATUS_UNKNOWN`

Limitation:

Existing wallet benefit-state records may not always use canonical benefit IDs. Until those records are migrated, some enrollment-required benefits can be blocked in strict production even when a user may have enrolled externally.

Recommended next ticket:

- migrate `userBenefitStates.benefitKey` to canonical benefit IDs
- add activation state support alongside enrollment state
- add admin/review workflow for approving canonical benefit records

## Test Coverage Added

Tests now cover:

- strict flat reward rejection
- strict category reward rejection
- strict rotating reward rejection
- verified category reward scoring
- observed-but-unverified rejection
- enrollment required and unknown user-state rejection
- activation required and unknown user-state rejection
- matched canonical benefit source/verification propagation
- strict Lululemon exact benefit with known enrolled state
- compatibility mode behavior remains explicit

## Result

Rewardly is now prepared for production-grade benefit trust enforcement at the recommendation layer. The live issuer-update pipeline is still not built.
