# Billing And Metering

## Initial Recommendation

Do not build billing in Sprint 9. Meter usage from day one.

## Billable Unit Hypothesis

Successful decision request, deduplicated by idempotency key.

## Usage Record

- usageRecordId
- organizationId
- environmentId
- endpoint
- decisionId
- timestamp
- status
- billable
- idempotencyKeyHash
- pricingPlanId
- requestUnits

Do not store money as floating-point values. Use integer minor units if pricing is added.

## Pricing Model Compatibility

Usage records should support subscription, usage-based, and base-plus-usage pricing later.
