# Multi-Tenancy

## Entities

- Organization
- Environment (`test`, `live`)
- API key
- Organization member
- External user reference
- Wallet
- Payment method
- Decision
- Decision event
- Usage record
- Webhook endpoint later
- Billing account later
- Data-retention policy

## Isolation Rules

Every customer-owned record must include `organizationId` and `environmentId`.

No organization may:

- Retrieve another organization's decisions.
- Reuse another organization's idempotency keys.
- Resolve another organization's users or wallets.
- Access another organization's usage.
- Use another organization's API keys.

## API Key Model

- Prefixes: `rw_test_` and `rw_live_`.
- Store only hash, prefix, last four, environment, scopes, status, createdAt, lastUsedAt.
- One-time display.
- Rotation and revocation required.
- Rate limits scoped by organization/environment/key.

## MVP Scope

No enterprise RBAC. Dashboard can start with owner/admin only.
