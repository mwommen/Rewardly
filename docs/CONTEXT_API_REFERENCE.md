# Context API Reference

Base path: `/api/v1`

## Validate Context

`POST /context/validate`

Public validation and normalization endpoint.

## Get User Context

`GET /context`

Requires bearer auth.

Returns the authenticated user's default canonical context.

## Normalize User Context

`POST /context`

Requires bearer auth.

Combines submitted context with saved preferences, constraints, and decision policy.

## Decision Policies

`GET /decision-policies`

Returns supported decision policies.

## Get Preferences

`GET /preferences`

Requires bearer auth.

Returns canonical decision preferences, constraints, and selected decision policy.

## Update Preferences

`PATCH /preferences`

Requires bearer auth.

Example:

```json
{
  "decisionPolicy": "minimize-complexity",
  "preferences": [
    {
      "type": "prefer_transferable_points",
      "value": true,
      "strength": "soft"
    }
  ],
  "constraints": [
    {
      "type": "never_finance",
      "value": true
    }
  ]
}
```
