# EPIC-014 Trust Infrastructure Audit

This audit reflects the repository state at implementation time.

## Current Decision Model

- Canonical payment outcomes are produced by `PaymentDecisionService`.
- Public V1 decisions are exposed through `POST /api/v1/payment-decisions`.
- Financial Intent `SMART_PAY` routes to the same canonical payment decision service.
- Mobile Smart Pay consumes the public payment decision response.

## Existing Explanation Structures

- `decisionIntelligenceService` already creates `DecisionExplanation`.
- V1 public payment responses previously exposed only compact `explanation.summary` and `explanation.factors`.
- Mobile reconstructed the visible detail screen from compact response fields.

## Existing Confidence Fields

- Canonical decisions include `confidence.score` and `confidence.label`.
- Decision intelligence includes component confidence for match quality, merchant resolution, benefit verification, wallet state, data freshness, and source quality.

## Existing Evidence and Reason Codes

- Existing evidence was grouped internally by merchant, benefit, wallet, scoring, and confidence.
- Existing reason codes were not yet formalized as a public taxonomy.
- Existing V1 API responses did not expose structured evidence.

## Existing Audit and Replay

- `decisionIntelligenceService` stores immutable in-memory audit records for tests and local runtime.
- Replay hashes exist for internal explanation snapshots.
- Public V1 APIs did not yet expose replay.

## Existing Version Tracking

- Decision engine version: `rewardly-decision-engine-v1`.
- Explanation version: `2026-07-22.1`.
- Benefit, merchant, wallet, and scoring versions existed in internal audit metadata when available.

## Public API Gap

Before EPIC-014, a partner could receive a recommendation but could not retrieve:

- full canonical evidence
- alternatives considered
- warning and assumption contracts
- replay status
- independence metadata
- a durable trust reference

## Client Duplication Gap

The mobile recommendation detail screen presented explanation details from compact API fields. It did not fetch canonical trust artifacts.

## EPIC-014 Direction

The current implementation should be extended, not replaced. Trust Infrastructure must adapt existing canonical decisions and internal decision intelligence into stable public contracts without changing recommendation scoring.
