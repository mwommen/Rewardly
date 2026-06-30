# Release Checklist — Credit Card Optimizer MVP

## What this MVP includes

- Merchant recommendation search and best-card lookup.
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

1. Link cards via Plaid and confirm the `Review linked cards` panel.
2. Show wallet summary and benefit credit rows in the dashboard.
3. Demonstrate merchant search with matched recommendations.
4. Show the wallet health score and next-card suggestion.
5. Use manual card selection for `Add manually` to show fallback wallet behavior.

## Buyer-ready talking points

- This MVP is a wallet-first experience: it combines linked accounts, reward coverage, and specific card recommendations.
- The demo includes real credit card mapping with fallback generic credit handling.
- Analytics are built in to track Plaid linking, wallet summary usage, and manual card actions.

## Known next priorities

- Add a polished onboarding flow for first-time users.
- Improve responsive layout and glassmorphism visual polish.
- Expand card catalog coverage and issuer support.
- Add a lightweight admin view for analytics and demo verification.
