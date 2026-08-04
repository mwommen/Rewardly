# Production Environments

## Backend

Required:

- `NODE_ENV=production`
- `PORT`
- `MONGO_URI`

Recommended:

- `FRONTEND_ORIGIN`
- `EXTENSION_ORIGIN`
- `REWARDLY_ACCESS_TOKEN_TTL_MS`
- `REWARDLY_REFRESH_TOKEN_TTL_MS`
- `REWARDLY_STRUCTURED_LOGS=true`

## Mobile

Required:

- `EXPO_PUBLIC_REWARDLY_API_BASE_URL`

## Database Initialization

Run production indexes before opening beta access:

```bash
npm --prefix backend run db:init:production
```

This creates indexes for beta auth, first-party auth, wallets, journeys, plans,
and preferences.
