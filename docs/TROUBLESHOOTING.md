# Troubleshooting

## Docker is not available

Error:

```text
zsh:1: command not found: docker
```

Install Docker Desktop and restart the shell.

## Missing production variables

Production mode requires:

- `MONGO_URI`
- `FRONTEND_ORIGIN`
- `EXTENSION_ORIGIN`

If one is missing, startup fails with a message listing the missing keys.

## Unsafe production values

Production startup rejects values such as `localhost`, `127.0.0.1`, `devUser`, and `manualTestUser` in production-only environment variables.

## Payment decision returns `ENGINE_FAILURE`

Try sandbox mode first:

```bash
REWARDLY_SANDBOX_MODE=true REWARDLY_DISABLE_REQUEST_ANALYTICS=true npm --prefix backend run dev
```

Then confirm the wallet uses known card IDs from `docs/examples/sample-developer-data.json`.

## Invalid request

Confirm:

- `merchant.name` exists.
- `purchase.amount` is a positive number.
- `purchase.currency` is `USD`.
- `wallet.cards` is an array.

## OpenAPI does not load

Check:

```bash
curl http://localhost:5001/api/v1/openapi.json
```
