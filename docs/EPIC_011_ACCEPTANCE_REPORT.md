# EPIC-011 Acceptance Report

## Scope

EPIC-011 established production identity, cloud sync, and release-foundation
work for Rewardly's private beta.

## Files Changed

- Backend auth, user data, middleware, DB collection helpers, and app routes
- Mobile auth/session storage, auth screen, account settings, cloud wallet,
  journey, plan, and preference integration
- Repository hygiene script and CI verification
- Production/auth/cloud-sync documentation
- Recommendation validation large-report replacement summary

## Identity

- Added first-party signup, signin, refresh, logout, session, and delete-account
  routes under `/api/v1`.
- Stores password hashes/salts and token hashes only.
- Derives authenticated user context server-side from Bearer tokens.
- Rejects invalid or expired sessions with stable structured errors.

## Cloud Sync

- Added user-scoped cloud wallet routes.
- Added user-scoped Payment Journey routes.
- Added user-scoped shopping plan routes.
- Added user preferences/favorite merchants routes.
- Added local-data migration endpoint with partial-failure reporting.

## Mobile Integration

- Added private-beta auth screen and secure session persistence.
- Added authorization headers and refresh-token retry handling.
- Switched wallet, planning, journey, and favorites toward cloud-backed state.
- Preserved local cache fallback for beta resilience.

## Account Deletion

- Added authenticated account deletion.
- Revokes sessions and soft-deletes wallet, journey, plans, and preferences.
- Added user-facing mobile warning before deletion.

## Repository Hygiene

- Removed `docs/RECOMMENDATION_VALIDATION_REPORT.json` from active Git tracking.
- Added ignore rules for generated recommendation JSON reports.
- Added `docs/RECOMMENDATION_VALIDATION_SUMMARY.md`.
- Added `npm run check:repo-hygiene`.

## Validation Executed

- `npm run verify:epic-011` - passed
- Repository hygiene check - passed
- Backend build - passed
- Backend tests - passed, 62 suites / 462 tests
- Shared package build - passed
- Frontend build - passed
- Extension syntax check - passed
- Mobile typecheck - passed
- Mobile lint - passed

## Known Limitations

- Mobile auth is private-beta identity, not a full commercial auth provider.
- Password reset email delivery is documented as unavailable in local beta.
- Cloud sync uses last-write-wins with `syncRevision`.
- Mobile dependencies must be installed before local typecheck/lint validation.

## Acceptance Status

Complete for private beta foundation. `npm run verify:epic-011` passes in the
local workspace with backend, frontend, shared package, extension, and mobile
validation.
