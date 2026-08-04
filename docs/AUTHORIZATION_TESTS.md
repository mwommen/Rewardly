# Authorization Tests

## Purpose

Verify that cloud user data belongs to the authenticated user and cannot be read
or mutated through client-provided IDs or route parameters.

## Automated Coverage

Run:

```bash
npm --prefix backend test -- --runInBand productionAuthorizationHttp.test.ts
```

The test suite covers:

- User A wallet isolation from User B
- User A Payment Journey isolation from User B
- User A Shopping Plan isolation from User B
- User A preferences isolation from User B
- Client-provided `userId` ignored on authenticated routes
- Route parameter ownership checks returning 404 for another user's plan
- Deleted users losing access
- Suspended users losing access
- Invalid tokens failing
- Expired sessions failing
- Endpoint-specific auth rate limiting and `Retry-After`

## Current Result

Passed:

- 1 test suite
- 4 tests

These tests exercise the HTTP layer through Express.
