# Rewardly

This workspace contains two main apps:

- `backend`: Express + TypeScript backend with card recommendation, Plaid linking, and benefit tracking.
- `frontend-vite`: Vite + React frontend for a wallet assistant that answers what card to use.

## MVP setup

1. Install dependencies separately:
   - `cd backend && npm install`
   - `cd frontend-vite && npm install`

2. Seed the backend card catalog:
   - `cd backend && npm run seed`

3. Run the backend dev server:
   - `cd backend && npm run dev`

4. Run the frontend app:
   - `cd frontend-vite && npm run dev`

5. Open the frontend in the browser and ask Rewardly what card to use for a purchase.

## Product direction

Rewardly should feel like ChatGPT for your wallet, not a credit-card testing dashboard. The backend recommendation engine stays intact, but the primary UI is now a single natural-language search box: "What are you buying or trying to use?"

The app translates that intent into the existing recommendation API and shows:

- Best card to use
- Why
- Benefits you would unlock
- Confidence

Technical fields like domain, amount, and MCC are still available in a hidden developer/debug panel for testing the engine.

## Extension checkout demo

Use this flow to demo the Amex Platinum Lululemon benefit at checkout:

1. Seed the catalog and demo wallet:
   - `cd backend && npm run seed`
   - `cd backend && npm run seed:demo`

2. Run the local services:
   - `cd backend && npm run dev`
   - `cd frontend-vite && npm run dev`

3. Load the unpacked Chrome extension from the `extension` folder.

4. In the Rewardly extension popup, confirm `API Base` is `http://localhost:5001`, keep `User ID` as `devUser`, and add `Amex Platinum` if it is not already selected.

5. Open `http://localhost:5173/demo-checkout-lululemon.html`. The extension should pop up at checkout with the Platinum Lululemon credit.

## Demo and release notes

- The frontend uses `frontend-vite/src/App.tsx` as the current MVP entrypoint.
- Use `cd backend && npm run seed:demo` to populate the demo linked accounts and benefit states for `devUser`.
- Use `cd backend && npm run demo:reset` to reset demo linked accounts and remap them with current logic.
- Analytics events are captured at `POST /api/analytics/event` and request logs are stored in `analyticsEvents`.
- API base URL is configured in `frontend-vite/src/lib/api.ts` and defaults to `http://localhost:5001`.
- The backend reads MongoDB URI from `MONGO_URI` or defaults to `mongodb://localhost:27017`.

## Release checklist

See `RELEASE_CHECKLIST.md` for a concise MVP demo and release readiness guide.

## Recommendation validation gate

The backend includes a deterministic recommendation validation framework for wallet-first correctness. From `backend/`:

```bash
npm test -- --runInBand
npm run build
npm run validate:recommendations:curated
npm run validate:recommendations:generated -- --seed 20260724 --count 1000
npm run validate:recommendations:coverage
npm run validate:recommendations:mutation
npm run validate:recommendations:full
npm run validate:recommendations:report
```

`validate:recommendations:mutation` uses test-only policy injection to simulate real engine defects. `validate:recommendations:coverage` enforces semantic branch coverage for eligibility, caps, credits, ranking paths, wallet behavior, classification confidence, date boundaries, and purchase channels. Generated pass rates validate deterministic fixture behavior; they do not prove live issuer terms are factually current.

## Merchant Intelligence validation gate

Sprint 7 adds a deterministic Merchant Intelligence layer between checkout detection and wallet decisioning. It resolves Merchant Identity separately from Merchant Context, keeps checkout providers separate from merchants, preserves merchant families, rejects deceptive domains, and emits safe evidence/trace summaries.

From `backend/`:

```bash
npm run validate:merchant-intelligence:curated
npm run validate:merchant-intelligence:full -- --seed 20260724 --count 1000 --report
npm run validate:merchant-intelligence:generated -- --seed 20260724 --count 10000
```

Reports are written to `docs/MERCHANT_INTELLIGENCE_REPORT.json` and `docs/MERCHANT_INTELLIGENCE_REPORT.md`.
