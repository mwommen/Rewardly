# Organizations and Projects

## Organization

An organization represents a partner account.

Fields:

- `organizationId`
- `displayName`
- `status`
- `metadata`
- `createdAt`
- `updatedAt`
- `createdBy`
- `schemaVersion`

Statuses:

- `active`
- `suspended`
- `deleted`

Suspended and deleted organizations cannot authenticate partner API keys.

## Project

A project represents a specific integration owned by an organization.

Fields:

- `projectId`
- `organizationId`
- `displayName`
- `environment`
- `status`
- `configuration`
- `createdAt`
- `updatedAt`
- `createdBy`
- `schemaVersion`

Environments:

- `sandbox`
- `test`
- `development`
- `live`

## Tenant Identity

Rewardly derives tenant identity from the API key. Clients do not supply an
authoritative organization or project in partner decision requests.

The tenant key used for Trust records is:

```text
organizationId:projectId:environment
```
