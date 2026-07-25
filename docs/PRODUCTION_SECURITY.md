# Rewardly Production Security

## Activation Tokens

Founder-created beta users receive a one-time activation token generated with
cryptographically secure randomness. The backend stores only a SHA-256 hash.
The raw token is shown only when created.

## Session Tokens

Successful activation returns a bearer session token. The backend stores only
the session-token hash. API requests use:

```http
Authorization: Bearer <session-token>
```

Production payment decisions ignore client-supplied identity and manual card
overrides.

## Website Storage

The private-beta website stores the session token in `localStorage`. This is
acceptable for the controlled beta but is not a permanent consumer-auth system.
A future production auth system should use stronger session management.

## Extension Storage

The production extension stores its session in `chrome.storage.local`, not
visible Developer Settings. The production package removes manual token-entry
controls.

## Extension Connection Codes

The authenticated website creates a short-lived one-time extension connection
code. The extension redeems the code once and receives its own stored session.
Codes expire after about five minutes and cannot be replayed after redemption.

## Wallet Authorization

Wallet APIs derive the beta user from the bearer token. Wallet updates validate
card slugs against the canonical card catalog, reject unknown cards, prevent
duplicates, and enforce a wallet-size limit.

## Route Access

Production route access is documented in `docs/PRIVATE_BETA_DEPLOYMENT.md`.
Development-only, QA, scrape, and sandbox routes are disabled unless explicitly
flagged.

## CORS

Production CORS allows only configured frontend and extension origins. Wildcard
authenticated origins are not allowed.

## Logging

Production logs must not include authorization headers, tokens, MongoDB URLs,
card numbers, full wallet payloads, or raw checkout contents. Decision debug
payloads are gated behind `REWARDLY_TRACE_DECISION`.

## Rate Limiting

The backend includes a simple in-memory rate limiter suitable for a small Render
private beta. It is not a distributed production rate limiter.

## MongoDB Security

Use MongoDB Atlas with a dedicated database user and least-privilege access.
Never commit `MONGO_URI`. Run `npm run db:init:production` to create required
indexes.

## Revocation

Revoking a beta user clears stored activation/session token hashes. Website and
extension requests fail after revocation.

## Known Private-Beta Limitations

- No full consumer authentication yet.
- Website session storage uses localStorage.
- Extension connection requires the tester to enter a short-lived code.
- Rate limiting is process-local.
- Plaid Production remains disabled.
