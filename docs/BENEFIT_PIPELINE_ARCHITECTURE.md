# Rewardly Benefit Pipeline Architecture

## Objective

Rewardly must keep benefit data accurate over time without letting automation silently affect production recommendations. The pipeline built in Ticket 002 creates the architecture future issuer extractors will plug into.

Trust rule:

Extraction never writes production benefits. Extraction creates candidates. Only approved candidates can be promoted.

## Lifecycle

Official Source

-> Extraction

-> Normalization

-> Candidate Benefit

-> Comparison

-> Risk Analysis

-> Human Review

-> Approval or Rejection

-> Promotion

-> Production Benefit

-> Recommendation Engine

## Components

### Source Registry

File:

- `backend/src/services/benefitSourceRegistryService.ts`

Responsibilities:

- centralize official source URLs
- track issuer, card slug, source type, parser strategy, priority, status, health, checksum, and extraction timestamps
- prevent source URLs from being hardcoded inside extractors

Supported source types:

- issuer benefit pages
- issuer reward pages
- issuer terms
- PDF benefit guides
- issuer FAQ pages
- official merchant benefit pages

### Extraction Framework

File:

- `backend/src/services/benefitExtractionService.ts`

Responsibilities:

- expose pluggable extractor strategies
- normalize all extractor output into one `ExtractorResult`
- create `CandidateBenefit` records
- keep candidates unverified and not production eligible

Supported future extractor strategies:

- HTML
- PDF
- structured JSON
- LLM-assisted extraction
- manual upload

Current implementation uses deterministic fixtures only. No live scraping is required.

### Candidate Benefits

Candidate benefits contain:

- candidate ID
- source ID
- observed timestamp
- raw extracted data
- normalized canonical benefit
- parser confidence
- warnings
- unsupported fields
- missing fields
- comparison status
- review status

Candidates are not production records.

### Change Detection

File:

- `backend/src/services/benefitComparisonService.ts`

Responsibilities:

- compare candidates to approved production benefits
- detect new, removed, changed, and matched benefits
- generate structured change records with old value, new value, field, reason, severity, and timestamp

Detected changes include:

- new benefit
- removed benefit
- multiplier changed
- merchant changed
- credit amount changed
- credit frequency changed
- activation requirement changed
- enrollment requirement changed
- effective date changed
- expiration changed
- restriction changed
- wording only
- metadata only
- confidence changed

### Risk Classification

Risk levels:

- low
- medium
- high
- critical

Initial policy:

- nothing auto-approves
- critical includes added benefits, removed benefits, and eligibility-rule changes
- high includes merchant mapping, multiplier, credit amount, credit frequency, and expiration changes
- medium includes restrictions and confidence changes
- low includes wording and metadata-only changes

### Review Queue

File:

- `backend/src/services/benefitReviewService.ts`

States:

- pending
- needs_review
- approved
- rejected

Review records preserve:

- reviewer
- review timestamp
- notes
- decision
- change summary

### Promotion Service

File:

- `backend/src/services/benefitPromotionService.ts`

Responsibilities:

- promote approved candidates only
- create new versions
- preserve previous version
- attach approval metadata
- return rollback token
- support rollback to previous version

Production recommendations continue using the previous approved version until promotion succeeds.

### Source Health Monitoring

File:

- `backend/src/services/benefitHealthService.ts`

Health statuses:

- healthy
- warning
- failed
- deprecated
- unknown

Health tracks parser failures, source unavailability, checksum changes, and deprecated sources.

### Staleness Detection

File:

- `backend/src/services/benefitHealthService.ts`

Thresholds:

- 30 days: warning
- 60 days: review recommended
- 90 days: production warning
- 180 days: high priority

Staleness alerts do not automatically disable benefits.

## Developer Commands

Fixture-backed commands:

- `npm run benefits:extract`
- `npm run benefits:compare`
- `npm run benefits:review`
- `npm run benefits:promote`
- `npm run benefits:health`
- `npm run benefits:staleness`

These commands are safe and do not perform live scraping.

## Internal APIs

Added:

- `GET /api/intelligence/sources`
- `GET /api/intelligence/pipeline/fixture`
- `POST /api/intelligence/pipeline/fixture/promote`

The fixture promotion endpoint returns a promotion result but does not mutate the live production card catalog.

## Future Scraper Architecture

Future issuer extractors should:

1. read source metadata from the Source Registry
2. fetch or receive source content
3. parse source content with the correct extractor strategy
4. emit normalized candidate benefits
5. never write production benefits

No downstream service should know whether the extractor was HTML, PDF, JSON, LLM-assisted, or manual.

## Future AI Extraction Integration

LLM-assisted extraction can be added as a parser strategy, but it must obey the same rules:

- output candidate benefits only
- include parser confidence
- include warnings and unsupported fields
- never auto-approve
- send all changes through review

## Review Workflow

1. Candidate is created.
2. Candidate is compared against approved benefit.
3. Changes are classified by risk.
4. Review record is created.
5. Reviewer approves or rejects.
6. Rejected candidates stop.
7. Approved candidates become eligible for promotion.

## Promotion Workflow

1. Promotion receives an approved review.
2. Previous production version is loaded.
3. New canonical benefit version is created.
4. `verificationStatus` becomes `verified`.
5. `productionEligible` becomes `true`.
6. `lastVerified` is set to promotion time.
7. Version metadata and rollback token are recorded.

## Rollback Workflow

Rollback restores the previous canonical version. Future persistent storage should keep benefit versions in a dedicated `benefitVersions` collection.

## Trust Guarantees

- Production benefits are never overwritten by extraction.
- Every extracted benefit becomes a candidate.
- Every candidate is compared against approved production data.
- Every change receives a risk level.
- Every production update requires explicit approval.
- Benefit history can be preserved.
- Rollback is supported.
- Source health is measurable.
- Benefit staleness is measurable.
- Future extractors can plug in without changing downstream review, promotion, or scoring services.

## Remaining Blockers Before Real Issuer Extractors

- Persist Source Registry records in MongoDB.
- Persist candidates, review records, source health checks, and benefit versions.
- Build idempotent migrations from legacy card fields into canonical production benefits.
- Add authenticated internal reviewer identity.
- Add a reviewer UI.
- Add real extractor implementations for issuer pages/PDFs/structured APIs.
- Add source checksum storage and diff persistence.
- Add production approval policy controls by risk level.
