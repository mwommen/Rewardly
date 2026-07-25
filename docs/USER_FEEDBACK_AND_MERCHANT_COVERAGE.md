# User Feedback & Merchant Coverage

Sprint 8.4 adds a lightweight feedback loop for private beta.

## Purpose

Rewardly now has three product-quality signals:

- Behavior: analytics events show what users did.
- Feedback: users can tell Rewardly whether a recommendation helped.
- Recommendation intelligence: the engine explains what it believed.

Together, these signals help identify where recommendations are trusted, confusing, late, or blocked by merchant coverage gaps.

## Feedback Lifecycle

1. Rewardly displays a checkout recommendation.
2. The popup asks, "Was this helpful?"
3. The user can choose `Yes` or `No`.
4. `Yes` records `recommendation_helpful`.
5. `No` opens one structured reason:
   - `wrong_card_recommended`
   - `wrong_merchant_detected`
   - `recommendation_too_late`
   - `recommendation_confusing`
   - `reward_estimate_incorrect`
   - `other`
6. `other` may include a short optional comment up to 250 characters.
7. The background worker posts the sanitized event to `POST /api/feedback`.
8. The backend validates privacy, normalizes merchant identity, and stores the event.

Feedback is optional and does not block checkout.

## Merchant Request Lifecycle

When Rewardly cannot produce a recommendation for a checkout context with wallet cards available, the empty state can show:

```text
Don't see support for this merchant yet?
Request support
```

The request includes:

- normalized merchant name when available
- merchant domain
- merchant category when known
- analytics session id
- extension version

Users do not manually type merchant details.

## Merchant Deduplication

Merchant requests are grouped through a conservative normalization path.

Examples:

- `Trader Joe's Grocery`
- `Trader Joes`
- `traderjoes.com`

become one requested merchant group when the known merchant registry does not strongly resolve them.

Known supported merchants are only applied when the merchant resolver has a strong match. Weak category or fuzzy matches do not silently convert an unsupported merchant request into an existing supported merchant.

## API

### `POST /api/feedback`

Records one feedback event.

Body:

```json
{
  "type": "recommendation_helpful",
  "installationId": "anonymous-install-id",
  "sessionId": "checkout-session-id",
  "merchantName": "Amazon",
  "merchantDomain": "amazon.com",
  "merchantCategory": "online_shopping",
  "confidenceBand": "High Confidence",
  "recommendedCardName": "Capital One Venture Rewards",
  "extensionVersion": "1.0"
}
```

Negative feedback also includes:

```json
{
  "type": "recommendation_not_helpful",
  "reason": "wrong_card_recommended",
  "comment": null
}
```

Merchant support requests use:

```json
{
  "type": "merchant_support_request",
  "merchantName": "Trader Joes",
  "merchantDomain": "traderjoes.com"
}
```

### `GET /api/feedback/summary`

Returns:

- total feedback
- helpful count and rate
- not helpful count and rate
- merchant request count
- most common issue
- confidence versus feedback

### `GET /api/feedback/merchants`

Returns:

- supported merchants
- total merchant count
- coverage by category
- requested merchants ranked by request count

### `GET /api/feedback/trends`

Returns:

- issue counts
- top requested merchants
- confidence versus feedback
- daily feedback counts

Dashboard endpoints are development-only by default. In production, enable explicitly:

```text
REWARDLY_ENABLE_FEEDBACK_DASHBOARD=true
```

## Privacy Guarantees

Feedback never stores:

- card numbers
- purchase totals
- order details
- payment information
- customer names
- street addresses
- authentication tokens
- cookies
- full URLs with sensitive query parameters

Free text is allowlisted to a maximum of 250 characters and rejected if sensitive patterns are detected.

## Current Limitations

- No third-party issue tracker integration.
- No sentiment analysis.
- No user-facing feedback history.
- Unsupported merchant requests can only be submitted where the extension is already active or where Rewardly reaches an empty checkout state.
- Dashboard output is API-first; no polished internal UI was added in this sprint.

## Future Extensions

- Add a product-only internal feedback dashboard UI.
- Add issue clustering once enough beta data exists.
- Use merchant request trends to prioritize manifest coverage changes.
- Correlate feedback trends with recommendation validation scenarios.
