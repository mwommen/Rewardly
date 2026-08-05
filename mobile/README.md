# Rewardly Mobile Smart Pay

Rewardly Mobile is an Expo React Native client for the Rewardly API. The app
does not contain recommendation logic. It authenticates the beta user, syncs
their cloud wallet, and sends Smart Pay requests to the backend decision engine.

## Run

Start the API in sandbox mode:

```bash
cd ../backend
REWARDLY_SANDBOX_MODE=true REWARDLY_DISABLE_REQUEST_ANALYTICS=true npm run dev
```

Install mobile dependencies:

```bash
cd ../mobile
npm install
```

Start Expo:

```bash
npm run start
```

For a physical device, set the API base URL to your computer's LAN IP:

```bash
EXPO_PUBLIC_REWARDLY_API_BASE_URL=http://192.168.1.20:5001 npm run start
```

## Smart Pay Flow

1. Open Rewardly.
2. Tap `Start Rewardly`, or choose `Try demo Smart Pay`.
3. Sign in or create a private-beta account.
4. Add supported cards or use the demo wallet.
5. Select a suggested or recent merchant.
6. Enter the purchase amount.
7. Tap `Get recommendation`.
8. Review the recommended card, estimated value, confidence, and explanation.
9. Tap `Complete Purchase` after paying to add it to your Payment Journey.

The target demo is under 30 seconds once the API is running.

## Demo Mode

Demo mode loads a local sample wallet:

- Capital One Venture Rewards
- American Express Gold Card
- Chase Sapphire Preferred

It also starts the user on Target so a first-time tester can immediately run a
sample purchase.

## Context Awareness

EPIC-005 adds lightweight location awareness while the app is open.

- Requests `When In Use` location permission only.
- Does not request background location.
- Does not use geofencing.
- Does not send push notifications.
- Uses a replaceable nearby merchant provider interface.
- Uses a mock nearby provider for MVP validation until a production merchant
  location dataset is available.

If location is denied, Smart Pay, manual merchant search, recent merchants, and
favorite merchants continue to work.

## Favorite Places

Users can favorite merchants from nearby results and merchant search. Favorites
are stored locally and appear first in Smart Pay shortcuts and search.

## Local Persistence

Cloud-synced for signed-in users and cached locally with Expo Secure Store:

- selected wallet cards
- completed Payment Journey entries
- payment notes
- shopping plans
- favorite merchants

Stored locally only:

- recent Smart Pay recommendations
- latest Wallet Coach snapshot
- dismissed coaching opportunities
- recent merchants
- last purchase amount

No card numbers, bank credentials, Plaid tokens, or payment credentials are
stored.

## API Boundary

The app calls:

- `GET /health`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/session`
- `DELETE /api/v1/me/account`
- `GET /api/v1/card-catalog`
- `GET /api/v1/me/wallet`
- `PUT /api/v1/me/wallet`
- `GET /api/v1/me/payment-journey`
- `POST /api/v1/me/payment-journey`
- `GET /api/v1/me/preferences`
- `PUT /api/v1/me/preferences`
- `POST /api/v1/me/migration/import`
- `POST /api/v1/intents`
- `POST /api/v1/payment-decisions`
- `GET /api/v1/decisions/:decisionId/trust`
- `POST /api/v1/me/plans`
- `GET /api/v1/me/plans`
- `POST /api/v1/me/plans/:planId/items`
- `POST /api/v1/me/plans/:planId/optimize`
- `POST /api/v1/me/plans/:planId/complete-item`

All recommendation scoring, benefit logic, wallet-first validation, merchant
intelligence, and explanation generation remain on the Rewardly API.

Recommendation detail screens consume canonical Trust Infrastructure outputs
when available. The mobile app renders explanation, evidence, alternatives,
warnings, confidence, and decision reference data from the platform; it does not
reconstruct recommendation reasoning locally.

Smart Pay now submits a `SMART_PAY` financial intent through
`POST /api/v1/intents` and unwraps the same payment decision response shape.
This keeps the mobile user experience unchanged while making the app a thinner
client of the platform orchestration layer.

## Merchant Knowledge

EPIC-010 moves merchant search and merchant metadata behind the Rewardly API.
The mobile Merchant Search screen consumes:

- `GET /api/v1/merchants`
- `GET /api/v1/merchant-search`
- `GET /api/v1/merchant-insights`

The backend owns merchant aliases, categories, MCCs, parent-company context,
loyalty programs, supported payment methods, and metadata. Local merchant
suggestions remain only as a fallback if the API is unavailable.

## Payment Journey

EPIC-006 adds a persistent Payment Journey. A Smart Pay recommendation can become
a completed payment when the user confirms they paid with the recommended card.

The journey stores:

- decision ID
- merchant
- purchase amount
- recommended and selected card
- estimated reward value
- confidence
- recommendation explanation
- purchase and completion timestamps
- optional user notes

The Journey tab displays a timeline, filters for week/month/all time, and a
local Monthly Progress summary. This is the foundation for future receipt
intelligence, wallet health, cloud sync, and AI coaching.

## Wallet Coach

EPIC-007 adds a Wallet Coach tab. It analyzes the local wallet and completed
Payment Journey entries to show:

- current optimization score
- top opportunity
- biggest recent win
- most improved category
- weekly summary
- subtle success moments

The coach is deterministic and explainable. It does not add AI, change
recommendation logic, or create new payment decisions. Opportunity estimates only
appear when repeated completed purchases support the estimate.

## Planned Spending

EPIC-008 adds a Planning tab. A user can:

1. Create a shopping plan.
2. Add multiple planned merchants and estimated amounts.
3. Optimize the plan through the Rewardly API.
4. See a best card per planned purchase and estimated total rewards.
5. Mark planned purchases complete.

Completed planned purchases flow into Payment Journey using the optimized API
decision. The mobile app does not contain planning recommendation logic.

## Boundaries

Not included in this sprint:

- AI-generated coaching
- AI planning
- chat interfaces
- receipt OCR
- push notifications
- background location
- geofencing
- Apple Wallet or Google Wallet
- NFC
- banking integrations
- Plaid
- subscriptions
- new recommendation algorithms
