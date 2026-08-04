# Payment Journey

The Payment Journey turns a one-time Smart Pay recommendation into a durable
history of better payment decisions.

## Data Model

Each completed payment is stored as a `PaymentJourneyEntry`:

- `paymentId`
- `decisionId`
- `merchant`
- `purchaseAmount`
- `currency`
- `recommendedCard`
- `selectedCard`
- `estimatedRewardValue`
- `confidence`
- `recommendationExplanation`
- `purchaseTimestamp`
- `completionTimestamp`
- `userNotes`
- `syncStatus`
- `schemaVersion`

The model is intentionally local-first but ready for cloud sync. `paymentId` and
`decisionId` make deduplication possible later.

## Flow

```text
Smart Pay Recommendation
  -> Complete Purchase
  -> PaymentJourneyEntry
  -> Secure Store
  -> Timeline
  -> Monthly Progress
  -> Future AI Insights
```

## Local Persistence

Payment Journey entries are stored in Expo Secure Store under
`rewardly.mobile.paymentJourney`.

The domain helper recovers from corrupted values by returning an empty or
sanitized journey instead of crashing the app.

## Timeline

The Journey tab supports:

- This Week
- This Month
- All Time

Entries are sorted newest first.

## Monthly Progress

Calculated locally from completed payments:

- Smart Payments
- Estimated Rewards
- Average Confidence
- Best Merchant
- Most Used Card

## Boundaries

Not included:

- receipt OCR
- camera integration
- bank synchronization
- Plaid
- cloud sync
- AI-generated coaching

The mobile app does not score cards or alter recommendation logic.
