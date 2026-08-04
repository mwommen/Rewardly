# Financial Intent Platform

Financial Intent is the orchestration layer for Rewardly platform capabilities.
Clients submit what the user is trying to do, and Rewardly determines which
engine should execute.

The Intent Engine does not replace existing engines. It coordinates them.

## Architecture

```text
Financial Intent
  -> Intent Engine
     -> PaymentDecisionService
     -> Planning Engine
     -> Payment Journey
     -> Wallet Coach
     -> Opportunity Engine
  -> Unified Response
```

## Supported Intent Types

- `SMART_PAY`
- `PLAN_PURCHASES`
- `COMPLETE_PURCHASE`
- `REVIEW_PAYMENT_HISTORY`
- `VIEW_WALLET_COACH`
- `VIEW_OPPORTUNITIES`
- `VIEW_WEEKLY_SUMMARY`

## Routing Flow

```text
POST /api/v1/intents
  -> validate intent envelope
  -> validate intent payload
  -> route to existing capability
  -> collect result
  -> write lightweight intent event
  -> return unified response
```

## Unified Response Contract

Every intent response includes:

- `intentId`
- `requestId`
- `timestamp`
- `intentType`
- `executedCapabilities`
- `result`
- `warnings`
- `errors`
- `metadata.executionTimeMs`
- `metadata.success`

## API Reference

```http
POST /api/v1/intents
GET /api/v1/intents/{intentId}
```

`GET /api/v1/openapi.json` includes the Financial Intent request and response
schemas.

## Event Logging

The MVP records in-memory intent events:

- intent type
- timestamp
- execution time
- capabilities invoked
- success/failure

This is enough to validate observability without adding analytics vendors,
billing, organizations, or cloud persistence.

## Mobile Integration

The mobile Smart Pay hook now submits `SMART_PAY` through the Intent API and
unwraps the same payment decision response shape the screen already expects.
The user experience remains unchanged.

## Sequence: Smart Pay

```text
Mobile Smart Pay
  -> POST /api/v1/intents { type: SMART_PAY }
  -> FinancialIntentService
  -> PaymentDecisionService
  -> Unified Intent Response
  -> Mobile renders result as PaymentDecisionResponse
```

## Boundaries

Not included:

- AI routing
- authentication
- billing
- organizations
- push notifications
- cloud sync
- receipt OCR

Future features should plug into the Intent Engine instead of creating a new
top-level platform abstraction.
