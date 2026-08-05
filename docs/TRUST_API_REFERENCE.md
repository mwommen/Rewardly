# Trust API Reference

Trust APIs are additive V1 endpoints for retrieving canonical decision trust artifacts.

## Endpoints

```http
GET /api/v1/decisions/{decisionId}
GET /api/v1/decisions/{decisionId}/explanation
GET /api/v1/decisions/{decisionId}/evidence
GET /api/v1/decisions/{decisionId}/alternatives
GET /api/v1/decisions/{decisionId}/trust
POST /api/v1/decisions/{decisionId}/replay
```

## Decision Summary

Returns recommendation, confidence, warnings, and trust reference metadata.

## Explanation

Returns the stable public explanation contract.

## Evidence

Returns structured evidence with deterministic ordering and pagination metadata.

## Alternatives

Returns top meaningful alternatives from cards evaluated by the canonical engine.

## Full Trust Record

Returns explanation, evidence, alternatives, warnings, assumptions, confidence, versions, reproducibility, provenance, and timestamps.

## Replay

Re-executes the canonical Payment Decision Service from the stored snapshot and reports `matched`, `mismatched`, or `not_replayable`.

## Error Model

Unknown decision IDs return:

```json
{
  "error": {
    "code": "DECISION_NOT_FOUND",
    "message": "Decision trust record was not found."
  }
}
```
