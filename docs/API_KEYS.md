# Partner API Keys

Partner API keys are scoped project credentials.

## Prefixes

- `rw_test_...` for sandbox, test, and development projects.
- `rw_live_...` for live projects.

## Storage

Rewardly stores only:

- SHA-256 key hash
- key preview
- scope list
- status
- timestamps

Plaintext API keys are returned only once at creation or rotation time.

## Supported Scopes

- `decision.read`
- `decision.write`
- `wallet.read`
- `trust.read`
- `admin`

The `admin` scope satisfies all partner API scope checks. Bootstrap management
endpoints also require `X-Rewardly-Admin-Token` when configured.

## Rotation

Use:

```http
POST /api/v1/partner/api-keys/{apiKeyId}/rotate
```

Rotation replaces the stored hash and invalidates the previous plaintext key.

## Revocation

Use:

```http
POST /api/v1/partner/api-keys/{apiKeyId}/revoke
```

Revoked keys return `PARTNER_KEY_REVOKED`.
