# EPIC-016 Partner Platform Audit

## Current State Before EPIC-016

Rewardly already exposed deterministic public payment decisions through
`POST /api/v1/payment-decisions`, plus Trust, Context, Merchant Knowledge, and
Financial Intent APIs. Those APIs were developer-friendly, but partner identity
was not a first-class platform concept.

## Gaps Found

- No canonical partner organization model.
- No project/environment model for sandbox vs live integrations.
- No partner API key lifecycle.
- No tenant-derived request context for partner calls.
- No per-partner usage ledger.
- No partner-specific authorization scopes.
- No partner-management bootstrap control.
- Public payment decisions accepted wallet cards directly but had no partner
  metadata, project metadata, or tenant-scoped trust ownership.

## Security Requirements

- API keys must never be stored in plaintext.
- Partner management must not be open in production.
- Tenant identity must be derived from the authenticated API key.
- Request identifiers and correlation identifiers must be attached to responses.
- Partner usage logging must avoid personal data and secrets.

## Scope Boundary

EPIC-016 intentionally does not add:

- Billing
- Stripe
- Developer dashboard UI
- Developer portal UI
- OAuth
- SAML
- SCIM
- SDKs
- Webhooks

## Implementation Decision

Partner Platform Foundation is additive. It introduces organizations, projects,
API keys, tenant context, partner usage tracking, and partner-scoped payment
decision access while preserving existing PaymentDecisionService behavior.
