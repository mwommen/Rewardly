# Authentication Decision

Rewardly now uses a first-party private-beta identity model for mobile cloud
sync and user-scoped platform data.

## Decision

- Email and password create a Rewardly user.
- Passwords are stored as PBKDF2 hashes with per-user salts.
- Access and refresh tokens are generated server-side.
- Only token hashes are stored in MongoDB.
- Authenticated routes derive `userId` from the access token.
- Clients cannot choose the authoritative user identity for cloud data.

## Beta Scope

This is appropriate for private beta. It is not a full commercial identity
platform. Future hardening should add email verification, password reset email
delivery, device/session management, MFA, abuse controls, and dedicated auth
provider review.

## Security Rules

- Never store card numbers or payment credentials.
- Never log passwords, emails, access tokens, refresh tokens, or authorization
  headers.
- Never accept client-supplied `userId` as authoritative on `/api/v1/me/*`.
- Account deletion revokes sessions and soft-deletes user-owned cloud records.
- Account deletion anonymizes the stored email and auth-provider identifier so
  the same email can recreate a new private-beta account.
- Active and suspended users are protected by partial unique indexes on email
  and auth-provider identifier.
