# Rewardly Private Beta Deployment

Rewardly's private beta runs with:

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- Extension: Unlisted Chrome Web Store package

## Production Blockers Found

- Payment decisions previously supported a single environment-level beta user.
- MongoDB connection logging exposed the configured URI.
- `/api/_env` was public in all environments.
- CORS allowed arbitrary Chrome extension origins in production.
- Extension source defaulted to localhost and development users.
- Server-owned beta wallets did not exist yet.

## Beta Identity

Founder commands run from `backend`:

```bash
npm run beta:create-user -- --name "Friend Name" --email "friend@example.com"
npm run beta:list-users
npm run beta:revoke-user -- --user-id beta_user_id
npm run beta:rotate-token -- --user-id beta_user_id
npm run beta:delete-user -- --user-id beta_user_id
```

Send the tester only the one-time activation token printed by `beta:create-user`.
Tokens are generated with secure randomness and stored only as SHA-256 hashes.
List commands never display existing tokens.

Beta API requests use:

```http
Authorization: Bearer <session-token>
```

Production ignores client-supplied `userId` and `manualCardSlugs` for payment decisions.
Development overrides only work when `NODE_ENV !== production` and
`REWARDLY_ALLOW_DEV_OVERRIDES=true`.

## Wallet Isolation

Authenticated wallet endpoints:

- `GET /api/wallet`
- `PUT /api/wallet/cards`
- `POST /api/wallet/onboarding-complete`

Each endpoint resolves the user from the bearer token. There is no route parameter
for another user's wallet.

## Render Backend

Render settings:

- Root Directory: `backend`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

Required production environment variables:

```text
NODE_ENV=production
PORT=<Render provided>
MONGO_URI=<MongoDB Atlas URI>
FRONTEND_ORIGIN=https://<vercel-app>
EXTENSION_ORIGIN=chrome-extension://<chrome-extension-id>
REWARDLY_ALLOW_DEV_OVERRIDES=false
REWARDLY_MERCHANT_INTELLIGENCE_MODE=registry
REWARDLY_TRACE_DECISION=false
REWARDLY_DECISION_LOGS=false
REWARDLY_ENABLE_ANALYTICS_DASHBOARD=false
REWARDLY_ENABLE_FEEDBACK_DASHBOARD=false
REWARDLY_ANALYTICS_RETENTION_DAYS=30
PLAID_ENV=sandbox
PLAID_CLIENT_ID=<sandbox only if enabled>
PLAID_SECRET=<sandbox only if enabled>
```

Production startup fails if `MONGO_URI`, `FRONTEND_ORIGIN`, or `EXTENSION_ORIGIN`
are missing or contain localhost-style development values.

## MongoDB Atlas

Setup checklist:

1. Create a MongoDB Atlas project and cluster.
2. Create a database user with least-privilege access for Rewardly.
3. Add Render outbound network access according to the Atlas networking model.
4. Set `MONGO_URI` on Render.
5. Initialize production indexes:

```bash
npm run db:init:production
```

The command is idempotent and creates indexes for cards, beta users, wallets,
benefit states, analytics retention, and feedback lookup. It does not seed demo
users, demo wallets, transactions, analytics, or feedback.

## Vercel Frontend

Vercel settings:

- Root Directory: `frontend-vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variables:

```text
VITE_APP_ENV=production
VITE_API_BASE_URL=https://<render-service>
```

Production builds fail if `VITE_API_BASE_URL` is missing.

## Chrome Extension Package

Build the Chrome Web Store beta ZIP from the repository root:

```bash
REWARDLY_EXTENSION_API_BASE=https://<render-service> \
REWARDLY_EXTENSION_APP_URL=https://<vercel-app> \
npm run extension:package:beta
```

The package command:

- Stages the extension into `release/rewardly-extension-beta`
- Writes production `config.js`
- Validates Manifest V3
- Produces `release/rewardly-extension-beta.zip`
- Prints a SHA-256 checksum
- Fails if packaged files contain `localhost`, `127.0.0.1`, `devUser`,
  `manualTestUser`, `REWARDLY_BETA_SESSION_TOKEN`, or `debug=true`

## Production Route Access

| Route | Production behavior |
| --- | --- |
| `GET /health` | Public liveness only |
| `GET /ready` | Public minimal dependency readiness |
| `GET /api/_env` | Disabled |
| `/api/qa/*` | Disabled |
| `/api/analytics/event` | Public anonymous event ingestion |
| `/api/analytics/*` dashboards | Disabled unless explicitly enabled |
| `/api/feedback` | Public sanitized feedback ingestion |
| `/api/feedback/*` dashboards | Disabled unless explicitly enabled |
| `/api/beta/activate` | Public activation endpoint |
| `/api/beta/extension-connections` | Beta authenticated connection-code creation |
| `/api/beta/extension-connections/redeem` | Public one-time extension-code redemption |
| `/api/wallet/*` | Bearer-token protected |
| `/api/decisions/payment` | Bearer-token protected |
| `/api/plaid/*` | Sandbox only unless explicitly configured later |
| `/api/plaid-sandbox/*` | Disabled in production unless explicitly enabled |
| `/api/scrape/*` | Disabled in production |
| `/api/opportunities/*` | Disabled in production for private beta |
| `/api/user-benefits/*` | Disabled in production for private beta |

## Verification

Run:

```bash
npm run verify:beta-production
```

For a full release rehearsal also run the extension package command with
production HTTPS URLs.

## Known Limitations

- This is private-beta bearer-token authentication, not full production auth.
- Tokens should be distributed out-of-band and revoked immediately if exposed.
- Plaid Production remains disabled.
- Chrome Web Store installation ID must be added to `EXTENSION_ORIGIN` after
  the unlisted listing is created.
