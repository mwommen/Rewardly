# Credit Card Optimizer

This workspace contains two main apps:

- `backend`: Express + TypeScript backend with card recommendation, Plaid linking, and benefit tracking.
- `frontend-vite`: Vite + React frontend for merchant recommendations and wallet benefits.

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

5. Open the frontend in the browser and use the merchant search MVP.

## Notes

- The frontend now launches `frontend-vite/src/App_recommendation.tsx` as the MVP entrypoint.
- API base URL is configured in `frontend-vite/src/lib/api.ts` and defaults to `http://localhost:5001`.
- The backend reads MongoDB URI from `MONGO_URI` or defaults to `mongodb://localhost:27017`.
