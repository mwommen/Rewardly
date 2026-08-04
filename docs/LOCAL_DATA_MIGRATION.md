# Local Data Migration

The migration endpoint imports existing mobile-local data into authenticated
cloud records.

## Endpoint

`POST /api/v1/me/migration/import`

Requires an authenticated access token.

## Supported Payloads

- `wallet.cardSlugs` or `wallet.cards[]`
- `paymentJourney[]`
- `plans[]`
- `preferences`
- `favorites`

## Behavior

- Wallet cards are validated against the card catalog.
- Payment Journey entries use client idempotency keys when available.
- Invalid items are skipped and reported without failing the whole migration.
- Favorites are stored in user preferences.

## Retry Safety

The migration returns per-section imported, skipped, and error counts. Clients
may retry after partial failures; idempotency keys prevent duplicate journey
entries where available.
