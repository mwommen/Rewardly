# Beta Release Checklist

## Automated Release Gate

Run:

```bash
npm run verify:epic-011
```

Expected coverage:

- Repository hygiene
- Backend build
- Backend tests
- Shared package compile
- Frontend build
- Extension syntax checks
- Mobile typecheck
- Mobile lint

## Production Setup

- Set production `MONGO_URI`.
- Set production CORS origins.
- Set auth token TTLs.
- Set auth rate-limit values.
- Run `npm --prefix backend run db:init:production`.
- Confirm `/health` and `/ready`.
- Confirm `/api/v1/auth/signup`.
- Confirm `/api/v1/auth/signin`.
- Confirm `/api/v1/me/wallet`.
- Confirm `/api/v1/payment-decisions`.

## Physical Device QA

1. Install the mobile app on a physical device.
2. Create a new account.
3. Close and reopen the app; confirm session restoration.
4. Add wallet cards.
5. Force quit and reopen; confirm wallet sync.
6. Complete a Smart Pay recommendation.
7. Confirm Payment Journey sync.
8. Create a Shopping Plan.
9. Add an item and optimize the plan.
10. Mark an item complete and confirm it appears in Payment Journey.
11. Favorite a merchant and confirm it persists after restart.
12. Turn off network and confirm cached wallet/journey still render.
13. Restore network and confirm new writes sync.
14. Log out and confirm protected screens are unavailable.
15. Log back in and confirm cloud data restores.
16. Delete the account and confirm old session no longer works.
17. Create a new account using the same email.

## Manual Browser QA

- Confirm existing Chrome extension checkout flow still works.
- Confirm no recommendation behavior changed.
- Confirm API health and payment decision endpoints respond in the target
  deployment.

## Release Blockers

- Failed `npm run verify:epic-011`
- Missing production database indexes
- Any tracked secrets or generated large JSON reports
- Auth routes returning stack traces
- Cross-user data access
