# Rewardly Product Experience Platform

Ticket #009 connects Rewardly's intelligence platform to a consistent user experience contract for the Chrome Extension, website, and future mobile clients.

## Presentation Architecture

The recommendation engine produces structured payment decisions. Clients should not interpret those raw decisions directly.

The Product Experience layer converts a `PaymentDecision` into a `RecommendationPresentationModel`.

The model includes:

- recommendation summary
- recommended card
- estimated value
- confidence
- explanation
- opportunity summary
- merchant summary
- wallet summary
- available actions
- performance measurements

The payment decision endpoint now returns:

```json
{
  "decision": {},
  "presentation": {},
  "lifecycle": []
}
```

Existing clients can continue using `decision`. New clients should prefer `presentation`.

## Recommendation States

Rewardly clients should render one of these states consistently:

- `loading`
- `merchant_detected`
- `analyzing_purchase`
- `recommendation_ready`
- `no_recommendation`
- `low_confidence`
- `wallet_information_missing`
- `merchant_unknown`
- `benefit_expired`
- `engine_error`
- `offline`

These states describe the user experience, not internal scoring.

## Recommendation Lifecycle

The standard lifecycle is:

1. Merchant detected
2. Recommendation requested
3. Decision generated
4. Presentation generated
5. Displayed to user
6. User interaction
7. Dismissed, saved, or viewed
8. Analytics recorded

Lifecycle events are deterministic and include:

- lifecycle ID
- stage
- merchant name
- recommendation state
- timestamp
- metadata

## Frontend Contracts

Clients should use the presentation contract for display:

- `recommendedCard.displayName`
- `recommendedCard.logoKey`
- `estimatedValue.label`
- `explanation.primaryReason`
- `opportunitySummary.benefits`
- `availableActions`

The Chrome extension now attaches `presentation` to the existing decision object when the backend returns it. If presentation is missing, it falls back to the raw decision path.

## User Actions

Canonical actions are platform-independent:

- `dismiss`
- `save`
- `expand_details`
- `view_explanation`
- `ignore`
- `never_show_again`
- `mark_incorrect`
- `open_dashboard`

The action list is generated from recommendation state.

## Feedback Events

Feedback events capture user intent for future improvement without changing recommendation logic.

Supported events:

- `recommendation_accepted`
- `recommendation_ignored`
- `recommendation_dismissed`
- `wrong_merchant`
- `wrong_card`
- `wrong_benefit`
- `incorrect_wallet_state`
- `user_override`

The current implementation structures these events but does not train or mutate the recommendation engine.

## Analytics Events

Product analytics are provider-agnostic. Supported event names include:

- `merchant_detected`
- `recommendation_displayed`
- `recommendation_clicked`
- `dismissed`
- `saved`
- `error`
- `unknown_merchant`
- `low_confidence`
- `wallet_missing`

The extension still uses its existing analytics path, while the product-experience layer defines canonical event objects for future provider swaps.

## Performance Targets

Rewardly's user experience targets are:

- Merchant detection under `200ms`
- Recommendation generation under `500ms`
- Presentation generation under `100ms`
- Popup display under `1000ms`

Presentation models include target and actual performance fields so clients and QA can compare behavior consistently.

## Future Dashboard Integration

The dashboard data model is backend-only for now.

It supports:

- current wallet
- active benefits
- expiring benefits
- recent recommendations
- recommendation history
- savings summary
- opportunity summary
- most used cards

No dashboard UI was added in this ticket.

## Constraints

- No recommendation scoring changes.
- No new recommendation engine behavior.
- No extension popup redesign.
- No mobile app code.
- No analytics vendor coupling.

The goal is a stable product-experience contract that lets every Rewardly client feel consistent while keeping the intelligence layer reusable.
