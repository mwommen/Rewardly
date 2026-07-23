# American Express Pilot Integration

Ticket 003 validates Rewardly's benefit intelligence architecture against one real issuer family: American Express.

This pilot does not scrape live pages in tests. It uses saved HTML fixtures that represent official Amex benefit-page content. Future live fetchers can download official HTML and pass it into the same extractor.

## Architecture

The lifecycle is:

Official Amex source registry entry -> saved HTML fixture -> HTML extractor -> canonical candidate benefits -> comparison -> risk classification -> review queue -> approval -> promotion -> production recommendation.

Candidate benefits are never production eligible when extracted. Production recommendations only use verified, promoted benefits.

## Source Registration

American Express sources live in `backend/src/services/benefitSourceRegistryService.ts`.

Registered pilot source types include:

- Card benefit page
- Rewards page
- Membership Rewards information
- Official PDF benefit guide
- Terms and conditions

URLs are centralized in the source registry. Extractors and tests resolve sources by `sourceId`.

## Extractor Flow

The HTML extractor is implemented in `backend/src/services/amexHtmlBenefitExtractor.ts`.

It accepts downloaded HTML through `ExtractorInput.fixturePayload.html`, parses `[data-rewardly-benefit]` blocks, and normalizes them into `CanonicalBenefitRecord` candidates.

The extractor preserves uncertainty:

- Missing required fields cause that benefit block to be skipped.
- Unknown optional fields remain `null` or empty arrays.
- Parser confidence is carried into the candidate.
- `verificationStatus` remains `automatically_extracted`.
- `productionEligible` remains `false`.

## Normalization

The pilot maps Amex fixture content into canonical benefit types including:

- Statement credits
- Merchant-specific credits
- Reward multipliers
- Travel/protection benefits
- Enrollment-required benefits
- Expiring benefits
- Restriction text

## Review Lifecycle

`backend/src/services/amexPilotService.ts` demonstrates:

1. Extract Version B fixture data.
2. Compare it against approved Version A data.
3. Generate review records for changed, new, and removed benefits.
4. Approve one candidate.
5. Reject one candidate and prove no production promotion occurs.

## Promotion Lifecycle

Promotion uses the existing `promoteApprovedCandidate()` service.

Approval converts a candidate into a verified production benefit:

- `verificationStatus: "verified"`
- `productionEligible: true`
- `lastVerified` set at promotion time
- `version` incremented
- previous version retained for rollback

## Rollback Lifecycle

Rollback uses the existing `rollbackPromotion()` service.

The Amex demo proves:

- Version 2 can be promoted.
- Version 1 remains available as `previousVersion`.
- Rollback restores Version 1.
- The version record still documents the Version 1 -> Version 2 promotion.

## Recommendation Validation

The pilot tests call the existing recommendation service with card catalog fixtures created from canonical Amex benefits.

This proves:

- Pending extracted candidates do not change production recommendations.
- Approved Version 1 remains live while review is pending.
- Promoted Version 2 changes the recommendation output.
- Rollback restores Version 1 recommendation behavior.

No recommendation scoring code is changed by this pilot.

## CLI Commands

Run from `backend/`:

```bash
npm run amex:extract
npm run amex:compare
npm run amex:review-demo
npm run amex:promote-demo
npm run amex:rollback-demo
```

All commands operate on fixture data.

## Future Live-Fetch Strategy

A future live fetcher should:

1. Resolve the source from the registry.
2. Download official issuer HTML or PDF content.
3. Pass the downloaded content into the extractor.
4. Store extracted candidates for review.

It should not write directly to production recommendation data.

## Known Limitations

- The Amex extractor currently targets saved HTML fixtures.
- PDF parsing remains a registered source strategy, not implemented for real extraction.
- Candidate/review/version records are demonstrated in service-level fixtures and are not persisted in a database yet.
- Reviewer authentication and a reviewer UI are not included in this ticket.
- Source checksums are evaluated as demo metadata but are not persisted between runs.

## Blockers Before Adding A Second Issuer

- Persist source checksums, candidates, reviews, and version history.
- Add reviewer identity and access controls.
- Define issuer-specific mapping rules outside code if mapping complexity grows.
- Add real fetch jobs with rate limiting and source-health backoff.
- Add extractor contracts for PDFs and structured JSON.
