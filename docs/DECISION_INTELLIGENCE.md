# Decision Intelligence

Ticket 006 adds structured explainability to Rewardly recommendations.

Rewardly should not only answer which card to use. It should also preserve why the decision was made, which evidence contributed, what was missing, and how the same decision can be replayed later.

## Architecture

Core implementation:

- `backend/src/services/decisionIntelligenceService.ts`
- `backend/src/decisionIntelligenceCli.ts`
- `backend/tests/decisionIntelligenceService.test.ts`

Integration points:

- `backend/src/services/recommendationService.ts`
- `backend/src/services/paymentDecisionService.ts`
- `packages/rewardly-core/src/domain.ts`

The recommendation algorithm is unchanged. Decision intelligence wraps the existing recommendation output with structured evidence and audit metadata.

## Decision Explanation Model

`DecisionExplanation` includes:

- `decisionId`
- `recommendationId`
- `userId`
- `merchantId`
- `merchantConfidence`
- `selectedCardId`
- `selectedBenefitId`
- `recommendationConfidence`
- `generatedAt`
- `explanationVersion`
- `evidence`
- `missingInformation`
- `alternativeCards`
- `warnings`
- `audit`
- `replayHash`

Evidence sections:

- Merchant evidence
- Benefit evidence
- Wallet evidence
- Scoring evidence
- Confidence evidence

The model is deterministic and JSON-friendly so it can be inspected by engineers, support, and future UI surfaces.

## Evidence Collection

Evidence is collected during scoring where possible.

The recommendation service now emits `explanationEvidence` for:

- merchant resolution strategy
- resolved merchant ID/name
- inherited merchant/category matches
- selected benefit ID/source/status
- wallet state used for the selected benefit
- reward rate and estimated value
- wallet cap-split adjustments
- missing information and warnings

The decision explanation service consumes that structured data instead of reconstructing explanations from display text.

## Confidence Calculation

Decision confidence uses weighted components, not a simple average.

Weights:

- Match quality: `28%`
- Merchant resolution: `20%`
- Benefit verification: `18%`
- Wallet state: `16%`
- Data freshness: `10%`
- Source quality: `8%`

Labels:

- `high`: `>= 0.80`
- `medium`: `>= 0.58`
- `low`: below `0.58`

Confidence output includes both the overall score and the component breakdown.

## Missing Information

Missing information is represented as structured objects.

Examples:

- `NO_RECOMMENDATION`
- `LOW_MERCHANT_CONFIDENCE`
- `WALLET_STATE_UNAVAILABLE`
- `BENEFIT_VERIFICATION_DATE_UNKNOWN`
- `WALLET_STATE_REQUIRED`

These warnings are intended for debugging and future UI education. The current extension UI is unchanged.

## Alternative Cards

Decision explanations include competing cards.

For each alternative:

- card ID
- card name
- estimated value
- confidence
- why it lost

This supports support/debug workflows today and future UI enhancements later.

## Decision Replay

`DecisionReplaySnapshot` captures:

- explanation version
- engine version
- merchant snapshot
- wallet snapshot
- recommendation snapshot
- expected selected card
- replay hash

`replayDecisionSnapshot()` verifies the selected card remains consistent for that snapshot. It does not call live issuer data or mutate wallet usage.

## Audit Trail

`persistDecisionAuditRecord()` stores immutable in-memory audit records for fixtures and tests.

Audit metadata includes:

- engine version
- benefit version marker
- merchant version marker
- wallet version hash
- scoring version
- explanation version

This establishes the contract for future database-backed immutable decision records.

## Developer Commands

Run from `backend/`:

```bash
npm run decision:explain
npm run decision:replay
npm run decision:confidence
npm run decision:audit
npm run decision:compare
```

All commands use deterministic fixtures and do not call live services.

## Observability

Structured logs are available through:

```bash
REWARDLY_DECISION_LOGS=1 npm run decision:replay
```

Log events include:

- replay executed
- recommendation completed

The logging API is intentionally small so more events can be added without changing the explanation model.

## Future UI Integration

The extension popup should remain simple. Future UI surfaces can selectively show:

- one consumer-friendly reason
- one confidence cue
- one missing-information warning when needed

The full explanation object should remain available for support and debugging.

## Known Limitations

- Audit records are currently in-memory.
- Replay verifies deterministic selected-card outcome from snapshots; it does not yet rerun against a historical card catalog database.
- Benefit, merchant, wallet, and scoring version fields are stable markers, not full persisted version joins yet.
- Explanations are structured but not localized.
- No generative AI explanation is used.
