# Release Checklist — Rewardly MVP

## What this MVP includes

- Wallet-assistant search and best-card lookup.
- Plaid-based card linking flow with auto-mapping and manual review.
- Wallet health and benefit summary for linked cards.
- Demo mode with seed data and resetable demo accounts.
- Analytics logging for key user events and request flow.

## Setup

1. Install dependencies
   - `cd backend && npm install`
   - `cd frontend-vite && npm install`

2. Seed the card catalog
   - `cd backend && npm run seed`

3. Seed demo data
   - `cd backend && npm run seed:demo`

4. Start backend
   - `cd backend && npm run dev`

5. Start frontend
   - `cd frontend-vite && npm run dev`

## Demo commands

- Reset demo accounts and remap them:
  - `cd backend && npm run demo:reset`

- Inspect backend health
  - `curl http://localhost:5001/api/health`

- Verify analytics endpoint
  - `curl http://localhost:5001/api/analytics/recent?userId=devUser`

## Key flows to demo

1. Open `http://localhost:5173/demo.html` as the demo launcher.
2. Confirm Amex Platinum is in the Rewardly extension wallet.
3. Open the Lululemon checkout page from the launcher.
4. Show the extension popup with the Platinum Lululemon credit.
5. Click `Enroll` and show the specific Amex benefit flow.

## 90 second script

1. "I have Amex Platinum in my wallet."
2. "I am checking out at Lululemon."
3. "Rewardly detects checkout and checks my wallet for live card benefits."
4. "It finds the Platinum Lululemon credit before I pay."
5. "Clicking Enroll takes me to the specific Amex benefit flow."
6. "Rewardly catches card benefits at the exact moment they matter."

## Buyer-ready talking points

- This MVP is a wallet-first experience: it combines linked accounts, reward coverage, and specific card recommendations.
- The demo includes real credit card mapping with fallback generic credit handling.
- Analytics are built in to track Plaid linking, wallet summary usage, and manual card actions.

## Known next priorities

- Add a polished onboarding flow for first-time users.
- Expand the natural-language intent parser.
- Expand card catalog coverage and issuer support.
- Add a lightweight admin view for analytics and demo verification.
