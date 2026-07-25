# Release Checklist — Rewardly MVP

## Sprint 7 Merchant Intelligence and Recommendation Accuracy Gate

Before a beta release, rerun:

- `cd backend && npm test -- --runInBand`
- `cd backend && npm run build`
- `cd backend && npm run validate:merchant-intelligence:curated`
- `cd backend && npm run validate:merchant-intelligence:registry`
- `cd backend && npm run validate:merchant-intelligence:coverage -- --seed 20260724 --count 1000`
- `cd backend && npm run validate:merchant-intelligence:parity`
- `cd backend && npm run validate:merchant-intelligence:privacy`
- `cd backend && npm run validate:merchant-intelligence:performance -- --seed 20260724 --count 1000`
- `cd backend && npm run validate:merchant-intelligence:full -- --seed 20260724 --count 1000 --report`
- `cd backend && npm run validate:merchant-intelligence:generated -- --seed 20260724 --count 10000`
- `cd backend && npm run validate:recommendations:full -- --seed 20260724 --count 1000 --report`
- `cd backend && npm run validate:recommendations:generated -- --seed 20260724 --count 10000`
- `cd backend && npm run validate:recommendations:report`
- `cd frontend-vite && npm run build`
- `cd frontend-vite && npm run lint`
- `cd packages/rewardly-core && ../../backend/node_modules/.bin/tsc -p tsconfig.json`
- `node --check extension/background.js`
- `node --check extension/content.js`

Current Sprint 7 status: PASS locally. Merchant Intelligence now has deterministic identity/context resolution, registry validation, semantic coverage, invariants, metamorphic checks, shadow parity, privacy redaction checks, performance guardrails, generated scenarios, safe extension signal collection, and a CI gate alongside recommendation validation. A fresh unzip/clone must install dependencies first because `node_modules` is intentionally excluded from distributed zip files.

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
