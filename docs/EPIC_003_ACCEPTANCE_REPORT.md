# EPIC-003 Acceptance Report

Status: Mobile MVP scaffold complete. Runtime testing on a physical phone requires installing Expo dependencies and running Expo locally.

Date: 2026-07-30

## Files Changed

- `backend/src/routes/v1/paymentDecisionRoutes.ts`
- `backend/tests/paymentDecisionV1App.test.ts`
- `mobile/`
- `docs/EPIC_003_ACCEPTANCE_REPORT.md`

## Mobile App Created

Created a new Expo React Native TypeScript app in `mobile/`.

Included:

- Expo project config
- TypeScript config
- ESLint config
- Prettier config
- NativeWind/Tailwind config
- React Navigation
- TanStack Query setup
- Axios API client
- Expo Secure Store persistence
- React Hook Form simulator
- Error boundary
- Theme primitives
- Loading and empty states

## Required Screens

Implemented:

- Splash/Welcome: `WelcomeScreen`
- Home: `HomeScreen`
- Wallet: `WalletScreen`
- Add Card: `AddCardScreen`
- Purchase Simulator: `PurchaseSimulatorScreen`
- Recommendation Details: `RecommendationDetailsScreen`
- Merchant Search: `MerchantSearchScreen`
- Recent Activity: `RecentActivityScreen`
- Settings: `SettingsScreen`

## API Integration

The app calls:

- `GET /health`
- `GET /api/v1/card-catalog`
- `POST /api/v1/payment-decisions`

Recommendation logic remains server-side. The app sends merchant, amount, and wallet card IDs to the existing public API and renders the response.

## Backend Support Added

Added:

```text
GET /api/v1/card-catalog
```

This returns addable card IDs and display names from existing Rewardly catalog data. It does not add recommendation logic.

## Wallet

Wallet is stored locally with Expo Secure Store for the MVP.

Users can:

- View owned cards.
- Add cards from the API catalog.
- Remove cards.
- Edit nicknames.

No card numbers are requested.

## Purchase Simulator

Users can enter:

- Merchant
- Purchase amount

The simulator calls `/api/v1/payment-decisions` and displays:

- Best card
- Estimated value
- Confidence
- Reason
- Explanation factors

Recent simulations are stored locally.

## Validation

Executed validation:

- `npm --prefix backend run build` - passed
- `npm --prefix backend test -- --runInBand paymentDecisionV1App.test.ts paymentDecisionV1Routes.test.ts paymentDecisionSandbox.test.ts` - passed, 3 suites / 25 tests
- `npm run build` - passed
- `npm test` - passed, 56 suites / 420 tests
- `npm run extension:check` - passed

Mobile dependency installation was not performed in this environment because
`mobile/node_modules` is not present. The mobile app has package manifests and
source code ready for `npm install` inside `mobile/`, after which
`npm run mobile:typecheck` and `npm run mobile:start` should be run locally.

## Manual QA

1. Start backend sandbox:

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

3. On phone, open the Expo app.
4. Add `Capital One Venture Rewards`.
5. Search/select `Target`.
6. Enter `127`.
7. Confirm a recommendation appears.
8. Open recommendation details.
9. Repeat with another merchant.

## Known Limitations

- No production auth.
- No push notifications.
- No location services.
- No Apple Wallet or Google Wallet integration.
- No NFC.
- No Plaid.
- Recent activity is device-local.
- Alternative cards are not displayed until the public V1 API exposes them.
