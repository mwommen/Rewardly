# Rewardly

Rewardly is an API-first Payment Intelligence Platform with first-party mobile
and browser experiences. It helps users make smarter payment decisions from the
cards they already own.

This workspace contains:

- `backend`: Express + TypeScript API for payment decisions, merchant
  intelligence, benefit intelligence, wallet intelligence, financial intents,
  and authenticated user cloud sync.
- `frontend-vite`: Vite + React web experience for onboarding and demos.
- `extension`: Chrome extension for checkout recommendations.
- `mobile`: Expo React Native Smart Pay client.
- `packages/rewardly-core`: shared runtime contracts used by the extension and
  backend.

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

Rewardly is not a dashboard. It is a real-time payment decision platform. The
backend remains the source of truth for recommendation logic; mobile, web, and
extension clients consume the API.

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

## EPIC-011 release foundation

Production identity and cloud sync now live behind authenticated `/api/v1/me/*`
routes. See:

- `docs/AUTHENTICATION_DECISION.md`
- `docs/CLOUD_SYNC_ARCHITECTURE.md`
- `docs/USER_DATA_MODEL.md`
- `docs/LOCAL_DATA_MIGRATION.md`
- `docs/ACCOUNT_DELETION.md`
- `docs/RELEASE_WORKFLOW.md`

Run the release-foundation verifier:

```bash
npm run verify:epic-011
```

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
