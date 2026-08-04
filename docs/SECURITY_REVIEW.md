# Security Review

## Scope

This review covers EPIC-011A private-beta hardening for authentication,
authorization, sessions, logging, repository hygiene, and release readiness.
Recommendation behavior was not changed.

## Confirmed Findings

### Authentication

- Email/password auth is implemented for private beta.
- Passwords are hashed with PBKDF2 using 120,000 iterations, 32-byte output,
  SHA-256, and per-user salts.
- Hashing now uses asynchronous `crypto.pbkdf2`, avoiding synchronous event-loop
  blocking while preserving existing hash compatibility.
- Access and refresh tokens are generated server-side.
- Only token hashes are stored in MongoDB.
- Invalid, expired, suspended, and deleted sessions return structured errors.

### Authorization

- `/api/v1/me/*` routes derive `userId` from the Bearer access token.
- Client-provided user IDs are ignored for cloud wallet, Payment Journey,
  Shopping Plans, preferences, migration, and account deletion.
- HTTP authorization tests verify cross-user isolation.

### Account Deletion

- Account deletion revokes sessions and soft-deletes user-owned data.
- Deleted user email and auth-provider IDs are anonymized so the same email can
  safely recreate an account.
- Active/suspended email uniqueness is preserved through partial unique indexes.

### Rate Limiting

- Auth endpoints have endpoint-specific in-memory rate limits.
- Rate-limited responses include `Retry-After`.
- Smart Pay and payment decision routes are not affected by auth-specific
  limits.

### Logging

- Operational auth rejection logs use a redaction helper.
- Emails, passwords, tokens, authorization headers, and secrets are redacted
  before structured logging.

### Repository Hygiene

- Generated recommendation JSON reports are ignored and removed from active Git
  tracking.
- Repository hygiene validation blocks tracked `.env` files, large files,
  generated recommendation JSON reports, build output, and common secret
  patterns.

## Password Hash Benchmark

Local benchmark, 5 runs:

- Previous synchronous PBKDF2 average: 19.18 ms
- New asynchronous PBKDF2 average: 18.94 ms
- Parameters unchanged: 120,000 iterations, 32-byte key, SHA-256
- Output compatibility: same algorithm and base64url encoding

## Remaining Risks

- In-memory rate limiting resets on process restart and does not coordinate
  across multiple server instances.
- Email verification and password-reset email delivery are not implemented.
- Account deletion is soft-delete based; future public launch should define a
  formal retention and recovery policy.
- Mobile auth is private-beta identity, not a full commercial identity provider.
- Dependency audit still reports mobile dependency vulnerabilities inherited from
  current Expo/React Native packages; no dependency upgrades were made in this
  release-hardening sprint.

## Recommendation

Security posture is appropriate for a controlled private beta after environment
variables, database indexes, and deployment secrets are verified in production.
