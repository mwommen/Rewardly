# Tenant Isolation

Rewardly partner isolation is based on server-derived organization and project
context.

## What Is Server-Derived

- `organizationId`
- `projectId`
- `environment`
- `apiKeyId`
- API key scopes
- request ID
- correlation ID

## Payment Decisions

Partner decision requests call the same PaymentDecisionService as the public API.
The submitted wallet still limits candidate cards, and the existing
wallet-first behavior remains unchanged.

## Trust Records

Partner-created Trust records are stored under a tenant ID:

```text
organizationId:projectId:environment
```

This keeps partner decisions separate from consumer-owned trust records.

## Usage Records

Usage records include:

- organization
- project
- environment
- API key ID
- endpoint
- status code
- latency
- request counts
- decision counts
- replay counts
- error counts

Usage records intentionally do not store API keys, secrets, full payloads, or
consumer personal information.

## Limitations

EPIC-016 does not add a developer portal, billing, or external partner account
provisioning workflow. Those should build on this tenant model later.
