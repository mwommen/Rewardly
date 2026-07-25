# Reward Knowledge Platform

Date: 2026-07-24

## Goal

Rewardly's benefit catalog now has a registry boundary that acts as the authoritative source for card-benefit rules consumed by the Wallet Decision Engine.

The registry does not add new user-facing features. It converts card benefit data into versioned, structured rules used for wallet-only decisions, traces, confidence, and audit logs.

## Benefit Registry

Service:

- `backend/src/services/benefitRegistryService.ts`

Responsibilities:

- load structured benefit definitions from supplied wallet cards
- normalize rules into registry entries
- attach registry IDs and version metadata
- expose rule precedence
- calculate recommendation confidence
- create decision audit logs

Every registry rule includes:

- issuer
- card
- reward program
- reward type
- earning rate
- eligible categories
- merchant restrictions
- purchase restrictions
- enrollment requirements
- activation requirements
- spending caps
- statement credits
- effective date
- expiration date
- source
- confidence
- last verified timestamp
- version number

## Versioning

`createBenefitVersionSnapshot()` preserves previous and next versions so historical decisions can be reproduced against the rule version that existed at the time of the decision.

The registry currently provides an in-memory version snapshot for tests and service-level validation. Persistent benefit-version storage remains part of the broader benefit pipeline roadmap.

## Rule Precedence

Registry precedence is explicit:

1. Merchant-specific
2. Portal-specific
3. Category
4. Base earning

The Wallet Decision Engine consumes registry rules and applies this precedence before same-tier value comparison.

Merchant-specific benefits remain structured data. No merchant-specific recommendation code was added.

## Confidence

Recommendation confidence combines:

- merchant classification confidence
- benefit confidence
- wallet state confidence
- data freshness

The current weighted model:

- merchant classification: `30%`
- benefit confidence: `35%`
- wallet state confidence: `20%`
- data freshness: `15%`

Confidence factors are exposed in rule traces so beta failures can be diagnosed without guessing.

## Decision Audit Log

The registry creates a decision audit log containing:

- decision ID
- merchant
- classification
- evaluated cards
- applied rules
- rejected rules and reasons
- winning rule
- confidence
- timestamp

The Wallet Decision Engine now returns this audit log with each evaluated decision.

## Source Boundary

The Wallet Decision Engine now consumes benefit rules through `loadBenefitRegistry()` rather than canonicalizing card benefits directly.

Remaining benefit definitions in tests are controlled fixtures used to validate issuer coverage and rule behavior. Existing card overrides and scraper outputs remain upstream sources that the registry can normalize.

## Validation

Regression coverage includes:

- benefit version changes
- expired rules
- conflicting rules
- precedence ordering
- confidence calculation
- audit log generation
- wallet-only evaluation
- major issuer benefit accuracy scenarios
