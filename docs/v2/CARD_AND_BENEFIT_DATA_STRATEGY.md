# Card And Benefit Data Strategy

## Current State

Confirmed from repository: Rewardly has card catalog records, benefit intelligence, benefit registry/versioning, issuer adapters, Amex pilot integration, review/promotion workflow, quality checks, and recommendation validation.

## Supported Card Definition

A card is supported when it has a canonical slug, display name, issuer, active status, source attribution, last verified timestamp, and at least one valid base earning rule.

## Required Fields

Issuer, card, reward program, reward type, earning rate, eligible categories, merchant restrictions, purchase restrictions, enrollment/activation requirements, caps, credits, effective/expiration dates, source, confidence, last verified, version.

## Operations Workflow

1. Extract or manually create benefit records.
2. Normalize into canonical model.
3. Review source attribution and confidence.
4. Run quality and recommendation regression tests.
5. Promote version.
6. Monitor low-confidence and disputed decisions.
7. Roll back if needed.

## Future Sources

Issuer feeds, data providers, partner contributions, human ops console, automated extraction, and AI-assisted review.

AI must never publish financial rules without deterministic validation and human approval.
