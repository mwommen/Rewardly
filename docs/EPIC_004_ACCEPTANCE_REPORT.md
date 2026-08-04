# EPIC-004 Acceptance Report

Status: Smart Pay mobile experience implemented. Physical-device QA still
requires installing mobile dependencies and running Expo.

Date: 2026-08-01

## Files Changed

- `mobile/`
- `docs/MOBILE_SMART_PAY_ARCHITECTURE.md`
- `docs/EPIC_004_ACCEPTANCE_REPORT.md`

## Implemented

- Re-centered navigation around `Smart Pay`.
- Redesigned Smart Pay as the primary first-use flow.
- Added suggested merchants and recent merchants.
- Persisted recent merchants and last purchase amount locally.
- Preserved recent recommendation persistence.
- Added demo mode with a sample wallet.
- Simplified wallet copy and local-data controls.
- Redesigned recommendation details around the selected card, estimated value,
  reward rate, confidence, and explanation.
- Updated mobile documentation and architecture diagram.

## API Boundary

The mobile app still uses the existing Rewardly API:

- `GET /health`
- `GET /api/v1/card-catalog`
- `POST /api/v1/payment-decisions`

No recommendation algorithms were added to the mobile app.

## Validation

Executed:

- `npm --prefix backend run build` - passed
- `npm run build` - passed
- `npm test` - passed, 56 suites / 420 tests
- `npm run extension:check` - passed

Mobile dependency installation was not performed because `mobile/node_modules`
is not present in this workspace. Run `cd mobile && npm install` before mobile
typecheck or Expo runtime testing.

## Manual QA

1. Start the API:

```bash
cd backend
REWARDLY_SANDBOX_MODE=true REWARDLY_DISABLE_REQUEST_ANALYTICS=true npm run dev
```

2. Start Expo:

```bash
cd mobile
npm install
npm run start
```

3. Open Rewardly.
4. Tap `Try demo mode`.
5. Confirm Smart Pay opens with Target selected.
6. Enter `127`.
7. Tap `Get recommendation`.
8. Confirm a recommendation appears in under 30 seconds.
9. Open `See why`.
10. Confirm the explanation is readable and API-driven.

## Known Limitations

- Screenshots and demo GIF were not generated in this environment.
- Mobile typecheck was not executed because mobile dependencies are not
  installed.
- There is no production authentication.
- Wallet and recent activity are local to the device.
- No push notifications, location, NFC, Plaid, or wallet integrations.
