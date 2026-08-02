# EPIC-005 Acceptance Report

Status: Context Awareness v1 implemented for the mobile app. Physical-device QA
still requires installing mobile dependencies and running Expo.

Date: 2026-08-01

## Files Changed

- `mobile/package.json`
- `mobile/app.json`
- `mobile/README.md`
- `mobile/src/hooks/useLocationPermission.ts`
- `mobile/src/hooks/useNearbyMerchants.ts`
- `mobile/src/hooks/useFavoriteMerchants.ts`
- `mobile/src/providers/nearbyMerchantProvider.ts`
- `mobile/src/types/location.ts`
- `mobile/src/storage/keys.ts`
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/screens/PurchaseSimulatorScreen.tsx`
- `mobile/src/screens/MerchantSearchScreen.tsx`
- `mobile/src/screens/SettingsScreen.tsx`
- `mobile/src/screens/WelcomeScreen.tsx`
- `mobile/src/navigation/AppNavigator.tsx`
- `docs/MOBILE_SMART_PAY_ARCHITECTURE.md`
- `docs/EPIC_005_ACCEPTANCE_REPORT.md`

## Location Architecture

The mobile app requests foreground `When In Use` location permission through
Expo Location. It never requests background location and does not implement
geofencing or push notifications.

```text
Location Services
  -> Nearby Merchant Provider
  -> Smart Pay prefill
  -> Rewardly API
  -> PaymentDecisionService
```

The mobile app remains a client. It does not score cards or generate payment
recommendations locally.

## Permission Flow

- Home explains why nearby location helps before requesting permission.
- The app requests When In Use permission only.
- If permission is denied, manual Smart Pay, merchant search, recent merchants,
  and favorites continue to work.
- Settings allows the user to request nearby suggestions later.

## Nearby Merchant Implementation

Nearby merchant detection uses `NearbyMerchantProvider`, a replaceable
interface. EPIC-005 ships with `mockNearbyMerchantProvider` because no
production merchant/location dataset exists yet.

The provider:

- accepts current coordinates
- returns merchant suggestions
- includes distance in miles
- sorts results by distance
- caches results for three minutes through TanStack Query

## Favorites

Users can favorite merchants from:

- Nearby results
- Merchant search

Favorites persist locally with Expo Secure Store and appear first in Smart Pay
shortcuts and merchant search.

## API Integration Verification

Recommendations still use:

- `POST /api/v1/payment-decisions`

No recommendation logic was added to the mobile app.

## Manual QA Instructions

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
4. Tap `Start Rewardly`.
5. Read the nearby location education state.
6. Grant When In Use location access.
7. Confirm nearby merchants appear sorted by distance.
8. Favorite a nearby merchant.
9. Tap a nearby merchant.
10. Confirm Smart Pay opens with the merchant preselected.
11. Enter only the purchase amount.
12. Confirm the recommendation comes from the existing API.
13. Disable/deny location and confirm manual Smart Pay still works.

## Validation

Executed:

- `npm --prefix backend run build` - passed
- `npm run build` - passed
- `npm test` - passed, 56 suites / 420 tests
- `npm run extension:check` - passed

Mobile dependency installation was not performed because `mobile/node_modules`
is not present in this workspace. Run `cd mobile && npm install` before mobile
typecheck or Expo runtime testing.

## Known Limitations

- Nearby merchants use a mock provider.
- No production merchant location dataset is connected yet.
- No screenshots or demo video were generated in this environment.
- No background location.
- No geofencing.
- No push notifications.
- Location is used only while the app is open.

## Future Path Toward Background Notifications

If users respond positively to nearby Smart Pay, the next phase can introduce:

- production merchant-location data
- explicit opt-in background location
- geofence evaluation
- notification copy and delivery rules
- battery and privacy controls
- stronger user education and permission controls

Those are intentionally excluded from EPIC-005.
