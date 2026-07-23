# Rewardly Benefit Review Queue

## Purpose

This queue identifies benefit records that should not be treated as fully trusted until source, verification, and production-approval metadata are complete.

The code-level review queue is available through:

- `GET /api/intelligence/benefits/review-queue`
- `npm run audit:benefits`

## Review Rules

A benefit needs review when any of the following is true:

- verification status is not `verified`
- confidence score is below `0.70`
- source URL is missing
- last verified timestamp is missing
- production eligibility is false
- date range is invalid
- benefit is expired or not yet effective
- merchant/category/channel mapping is missing for a non-flat benefit

## Current High-Priority Review Items

| Card | Benefit | Reason Review Is Required | Missing Information | Production Eligibility | Recommended Next Action |
| --- | --- | --- | --- | --- | --- |
| American Express Gold Card | Dining/grocery/travel rewards | Seed has source URL but partial verification metadata | precise source section, last verified evidence, caps/limitations | Not fully proven for canonical production scoring | Verify against issuer page and terms, add canonical records |
| Chase Sapphire Preferred | Travel/dining/grocery/streaming rewards | Legacy category map, not canonical persisted benefits | last verified timestamp, caps, eligible channels | Not fully proven for canonical production scoring | Verify category terms and migrate to canonical records |
| Chase Freedom Unlimited | Travel/dining/drugstore/base rewards | Legacy category map | last verified timestamp, exact source title, limitations | Not fully proven for canonical production scoring | Verify issuer reward terms |
| Citi Custom Cash | Top-category rewards | Complex cap/category logic represented as simple map | cap metadata, category eligibility rules, last verified timestamp | Not fully proven for canonical production scoring | Model top-category mechanic explicitly |
| Discover it Cash Back | Rotating rewards | Rotating categories represented too broadly | active quarter windows, activation status, spending caps | Not fully proven for canonical production scoring | Source current quarter terms and expiration |
| Capital One SavorOne | Dining/entertainment/streaming/grocery rewards | Legacy category map | source section, exclusions, last verified timestamp | Not fully proven for canonical production scoring | Verify issuer rewards page |
| Generic Credit Card | Default reward | Placeholder/demo card | source, issuer, verification, production approval | Should remain non-production | Keep demo-only or remove from beta wallets |

## Approved Internal-Beta Exact Benefits

These records have enough local metadata to keep the current MVP behavior working while the full issuer verification process is built:

| Card | Benefit | Source | Current Status |
| --- | --- | --- | --- |
| The Platinum Card from American Express | Lululemon quarterly statement credit | Amex issuer benefit URL in seed data | Production eligible for current internal beta seed |
| The Platinum Card from American Express | Saks semi-annual statement credit | Amex issuer benefit URL in seed data | Production eligible for current internal beta seed |
| Capital One Venture X | Capital One Travel credit | Capital One issuer URL in seed data | Production eligible for current internal beta seed |

## Notes

Do not invent issuer facts to clear this queue. If a field cannot be verified from an official source, leave it missing, mark the benefit `needs_review` or `unverified`, and keep `productionEligible` false.

## Next Action

Build the later extraction/review pipeline as:

official source -> extraction -> normalized candidate -> comparison -> review -> approval -> production benefit
