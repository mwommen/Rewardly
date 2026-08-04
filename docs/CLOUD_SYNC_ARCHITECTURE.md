# Cloud Sync Architecture

Rewardly is an API-first Payment Intelligence Platform with first-party mobile
and browser experiences.

## Synced Data

- Wallet card slugs
- Payment Journey entries
- Shopping plans and plan items
- Preferences, including favorite merchants

## Data Ownership

Every synced record is scoped by authenticated server-side `userId`.
Client-supplied identity is ignored on authenticated `/api/v1/me/*` routes.

## Mobile Behavior

The mobile app is cloud-first and local-resilient:

1. Read cloud state when signed in.
2. Cache successful reads locally.
3. Continue using local cache if the API is temporarily unavailable.
4. Best-effort write cloud records for completed payments and favorites.

## Conflict Policy

Private beta uses last-write-wins with a `syncRevision` on user-owned records.
This is simple enough for early testers and explicit enough to replace with
field-level conflict handling later.

## Future Work

- Push/pull delta sync
- Device metadata
- Conflict resolution UI
- Cloud backup status indicators
- Multi-device account management
