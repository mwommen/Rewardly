# EPIC-015 Context Audit

## Existing Architecture Reviewed

- Purchase context exists in `PaymentDecisionRequest.purchaseContext` and purchase intelligence converts structured purchase data into `RecommendationPurchaseContext`.
- Wallet state exists in `walletService`, wallet benefit state repositories, and wallet intelligence services.
- Financial Intent exists in `financialIntentService` and routes SMART_PAY, planning, purchase completion, and read-oriented intents.
- User preferences exist in `userPreferences` through `/api/v1/me/preferences`.
- Merchant normalization exists in Merchant Intelligence and the legacy merchant detection service.
- Decision inputs currently include merchant, amount, MCC, wallet card slugs, purchase context, and merchant signals.
- User profile/authentication exists through production auth and server-owned user/session records.
- Policy handling existed as implicit product behavior rather than a canonical model.

## Gaps Identified

- Preferences were UI/product preferences, not canonical decision preferences.
- Constraints were not represented as first-class inputs.
- Financial intent type and decision optimization policy were separate concepts.
- Clients could submit purchase context, but there was no canonical context normalization contract.
- Decision Infrastructure could consume purchase context, but not a broader context object.

## Implementation Direction

EPIC-015 adds Context Infrastructure as a normalization and validation layer. It does not move recommendation logic out of Decision Infrastructure.

Context Infrastructure owns:

- canonical context model
- decision policy catalog
- preference normalization
- constraint normalization
- context validation
- versioned context APIs

Decision Infrastructure consumes normalized context as an input and metadata source.
