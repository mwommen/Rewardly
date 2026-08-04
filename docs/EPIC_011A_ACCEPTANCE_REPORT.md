# EPIC-011A Acceptance Report

## Executive Summary

EPIC-011A hardens the EPIC-011 identity and cloud-sync foundation for controlled
private beta. It standardizes auth request IDs, makes password hashing
asynchronous, adds endpoint-specific auth rate limits, validates account
deletion/recreation behavior, expands HTTP authorization coverage, and updates
release/security documentation.

## Security Improvements

- Replaced auth-route `Math.random()` request IDs with `createRequestId()`.
- Added endpoint-specific auth rate limits with configurable windows and
  `Retry-After`.
- Switched PBKDF2 password hashing from sync to async without changing
  parameters or output compatibility.
- Anonymized deleted-account email/auth-provider identifiers.
- Added partial unique indexes for active/suspended user email and auth-provider
  identifiers.
- Added HTTP authorization tests for user-owned data isolation.
- Added repository hygiene validation for large files, generated reports,
  secrets, env files, and build artifacts.

## Authentication Results

- Signup: tested and passing.
- Login: tested and passing.
- Logout: route remains functional and revokes tokens by hash.
- Session restoration: access-token session route tested through auth
  middleware.
- Account deletion: tested and passing; deleted users lose access.
- Recreate same email after deletion: tested and passing.
- Suspended users: tested and blocked.
- Expired sessions: tested and blocked.
- Invalid tokens: tested and blocked.

## Authorization Results

HTTP tests verify:

- User A cannot access User B wallet.
- User A cannot access User B Shopping Plans by route parameter.
- User A cannot access User B Payment Journey or preferences.
- Client-provided `userId` is ignored.

## Password Hash Benchmark

- Runs: 5
- Previous sync PBKDF2 average: 19.18 ms
- New async PBKDF2 average: 18.94 ms
- Parameters unchanged: 120,000 iterations, 32-byte output, SHA-256

## Repository Validation

- Large generated recommendation JSON reports are excluded from Git tracking.
- Secret scan passes through `npm run check:repo-hygiene`.
- `.env.example` files remain tracked; real `.env` files remain ignored.
- Documentation updated for security, auth, authorization, release, and QA.

## Verification Results

Executed:

```bash
npm --prefix backend test -- --runInBand productionAuthorizationHttp.test.ts productionIdentityCloudSync.test.ts
npm run verify:epic-011
```

Results:

- Targeted auth/authorization tests: passed, 2 suites / 11 tests
- Full verification: passed
- Backend tests: passed, 62 suites / 466 tests
- Backend build: passed
- Shared package build: passed
- Frontend build: passed
- Extension syntax check: passed
- Mobile typecheck: passed
- Mobile lint: passed
- Repository hygiene: passed

## Remaining Risks

- Auth rate limiting is in-memory and should move to Redis or managed edge
  controls before public launch.
- Email verification and automated password-reset delivery are not implemented.
- Account deletion uses soft deletion and anonymization; legal retention policy
  should be reviewed before public launch.
- Mobile dependency audit reports inherited package vulnerabilities from the
  current Expo/React Native dependency tree.

## Status

APPROVED FOR MAIN

## Merge Recommendation

Merge into main
