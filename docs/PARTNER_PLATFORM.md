# Partner Platform

Rewardly's Partner Platform is the B2B integration layer for external
applications that want to use Rewardly's payment intelligence without rebuilding
the recommendation engine.

## Core Concepts

- Organization: the partner company or account.
- Project: an integration surface owned by an organization.
- Environment: `sandbox`, `test`, `development`, or `live`.
- API key: a scoped credential tied to one project.
- Tenant context: the server-derived organization, project, and environment
  attached to every partner request.

## Request Flow

1. Partner creates an organization, project, and API key through bootstrap admin
   endpoints.
2. Partner calls `POST /api/v1/partner/payment-decisions` with
   `Authorization: Bearer rw_test_...` or `Authorization: Bearer rw_live_...`.
3. Rewardly authenticates the key and derives tenant identity.
4. Rewardly validates scopes and rate limits.
5. Rewardly calls the existing PaymentDecisionService.
6. Rewardly writes a tenant-scoped Trust record.
7. Rewardly returns the normal V1 payment decision response plus partner
   metadata.

## Partner Endpoints

```http
POST /api/v1/partner/organizations
POST /api/v1/partner/projects
POST /api/v1/partner/api-keys
POST /api/v1/partner/api-keys/{apiKeyId}/rotate
POST /api/v1/partner/api-keys/{apiKeyId}/revoke
POST /api/v1/partner/payment-decisions
GET /api/v1/partner/usage
```

## Production Bootstrap

Set `REWARDLY_PARTNER_ADMIN_TOKEN` before using partner-management endpoints in
production. Management requests must include:

```http
X-Rewardly-Admin-Token: <token>
```

Local and test environments may bootstrap without this variable unless it is
explicitly configured.

## Design Constraint

The Partner Platform does not duplicate recommendation logic. It wraps the
existing engine with identity, authorization, rate limits, tenant context, usage,
and documentation.
