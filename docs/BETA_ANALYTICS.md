# Beta Analytics & Product Intelligence

Sprint 8.2 adds a privacy-first analytics layer for private beta product learning.

## Purpose

Rewardly analytics exists to answer product-quality questions:

- How many checkout recommendations are generated?
- How many are displayed successfully?
- Which merchants produce successful recommendations or failures?
- How often users open details or dismiss the popup?
- How often recommendations are low confidence?
- Where errors occur?
- How quickly recommendations appear?
- What aggregate reward value is being shown?
- Which merchants have low reliability or confidence?
- How long it takes a new install to see a first successful recommendation?

It must not collect personal, financial, or purchase-detail data.

## Event Pipeline

All events pass through `RecommendationAnalyticsService`.

The extension still sends lightweight events through:

```text
POST /api/analytics/event
```

The backend normalizes them into typed events:

- `checkout_detected`
- `merchant_classified`
- `recommendation_requested`
- `recommendation_generated`
- `recommendation_acknowledged`
- `popup_displayed`
- `popup_hidden`
- `popup_dismissed`
- `continue_checkout_clicked`
- `details_opened`
- `retry_clicked`
- `recommendation_failed`
- `recommendation_timeout`
- `extension_communication_failed`

`recommendation_acknowledged` is schema-ready but should only be emitted by an intentional user action, such as a future "I'll use this card" control. Rewardly does not infer acknowledgement from popup display.

## Stored Fields

Stored analytics fields are allowlisted:

- anonymous `installationId`
- `sessionId`
- event type
- timestamp and expiry
- merchant display name
- merchant category
- checkout stage
- confidence band
- recommendation latency
- popup latency
- merchant classification latency
- aggregate estimated reward value displayed
- aggregate advantage over the runner-up card
- reward type bucket
- extension version
- recommendation engine version
- merchant registry version
- browser family
- operating system family
- error type/code
- basic booleans such as popup visible
- wallet card count

Rewardly does not store purchase totals. Reward value fields represent the recommendation value displayed by the engine and are used only in aggregate metrics.

## Version And Environment Metadata

Every extension analytics event includes:

- `extensionVersion`
- `recommendationEngineVersion`
- `merchantRegistryVersion`
- `browserFamily`
- `operatingSystem`

The browser and OS values are coarse families used for troubleshooting beta regressions. Rewardly does not collect hardware identifiers, installed extensions, IP addresses, device IDs, or browser history.

## Merchant Health

`GET /api/analytics/merchants` returns a `healthScore` from 0-100 for each merchant.

The score combines:

- recommendation success rate
- unknown merchant rate
- average confidence
- recommendation and timeout failures
- extension communication failures
- average recommendation latency

The score is internal and directional. It is intended to prioritize QA and merchant hardening work, not to rank merchants for users.

## Recommendation Value Metrics

`GET /api/analytics/value` returns aggregate-only value metrics:

- average estimated rewards displayed
- average advantage over the second-best card
- reward value distribution buckets
- reward type distribution
- most common reward type

No individual purchase amount, order total, order ID, or transaction history is stored.

## Analytics Health

`GET /api/analytics/health` reports the analytics system itself:

- events received
- events rejected
- privacy validation failures
- failed writes
- cleanup duration
- dashboard query latency
- event processing latency

These metrics are for debugging ingestion and dashboard stability during beta.

## Privacy Rules

Events are rejected before storage if they contain:

- card numbers
- emails
- phone numbers
- addresses
- authentication tokens
- cookies
- order totals or purchase amounts
- order identifiers
- payment identifiers
- customer names through allowlist exclusion
- full URLs with query parameters
- free-form raw payloads

The service uses an allowlist first and a sensitive-value validation pass second.

## Retention

Default retention is 30 days.

Configure with:

```text
REWARDLY_ANALYTICS_RETENTION_DAYS=30
```

Expired-event cleanup runs when dashboard summary data is requested and is also available through the service.

## Internal Dashboard APIs

These endpoints are development-only by default. In production they require:

```text
REWARDLY_ENABLE_ANALYTICS_DASHBOARD=true
```

Endpoints:

- `GET /api/analytics/summary`
- `GET /api/analytics/merchants`
- `GET /api/analytics/confidence`
- `GET /api/analytics/errors`
- `GET /api/analytics/funnel`
- `GET /api/analytics/value`
- `GET /api/analytics/health`

## Current Limitations

- No third-party analytics SDK is used.
- No user profiling or browsing history reconstruction is implemented.
- Dashboard output is API-first for this sprint; a polished internal UI can consume these endpoints later.
- Live merchant QA should verify dashboard updates after real extension use.
- Time-to-first-recommendation is measured only when both `extension_installed` and a later `recommendation_generated` event exist for the same anonymous installation.
