# Mobile Smart Pay Architecture

Rewardly Mobile is a client of the existing Rewardly API.

```text
User
  |
  v
Expo React Native App
  |
  |-- Location Services (When In Use only)
  |     |-- permission education
  |     |-- current location while app is open
  |
  |-- Nearby Merchant Provider
  |     |-- mock provider for MVP
  |     |-- replaceable provider interface
  |
  |-- Secure Store
  |     |-- wallet card IDs
  |     |-- recent merchants
  |     |-- favorite merchants
  |     |-- recent recommendations
  |     |-- completed payment journey
  |     |-- payment notes
  |     |-- wallet coach snapshot
  |     |-- dismissed opportunities
  |     |-- last purchase amount
  |
  |-- Smart Pay UI
  |     |-- merchant
  |     |-- purchase amount
  |     |-- owned card IDs
  |
  |-- Planned Spending UI
  |     |-- shopping plans
  |     |-- planned purchases
  |     |-- plan optimization responses
  |
  v
Rewardly API
  |
  |-- /api/v1/card-catalog
  |-- /api/v1/intents
  |-- /api/v1/payment-decisions
  |-- /api/v1/plans
  |
  v
PaymentDecisionService
  |
  |-- Benefit Registry
  |-- Merchant Intelligence
  |-- Wallet Intelligence
  |-- Recommendation Validation
  |
  v
Smart Pay Recommendation
  |
  v
Payment Journey
  |
  v
Wallet Coach
  |
  v
Future AI Insights
```

## Rule

The mobile app never scores cards and never generates recommendation logic. It
renders the response returned by `/api/v1/payment-decisions`.

For Smart Pay, mobile now submits a `SMART_PAY` intent through
`/api/v1/intents`. The Intent Engine routes to `PaymentDecisionService` and
returns the same decision shape the app already renders.

## Smart Pay Screen

The Smart Pay screen is the primary product surface. It collects the minimum
input needed for a decision:

- merchant
- amount
- selected wallet cards

It then shows the recommendation returned by the API.

## Context-Aware Home

The Home screen requests When In Use location permission and shows nearby
merchants while the app is open. Selecting a nearby merchant launches Smart Pay
with that merchant preselected. The user still enters the purchase amount before
the app calls `/api/v1/payment-decisions`.

Background location, geofencing, and push notifications are intentionally out of
scope for the MVP.

## Payment Journey

The Payment Journey is local-first in EPIC-006. It records user-confirmed
completed purchases after Smart Pay returns an API recommendation. This creates a
timeline and Monthly Progress summary without changing recommendation logic.

Future cloud synchronization can sync `PaymentJourneyEntry` records by
`paymentId` and `decisionId`.

## Wallet Coach

EPIC-007 adds a deterministic Wallet Coach. It consumes the local wallet and
Payment Journey to produce:

- one top opportunity
- optimization score
- weekly summary
- biggest recent win
- most improved category
- subtle success moments

Wallet Coach does not call a model and does not change recommendation behavior.
The future AI coach should consume the Wallet Coach snapshot instead of
inventing new payment logic.

## Planned Spending

EPIC-008 adds a Planning tab backed by the versioned Planning API. Users can
create shopping plans, add planned purchases, optimize the plan, and mark
purchases complete. Completion writes the optimized API decision into Payment
Journey.

Planning intelligence remains backend-owned. The mobile app does not choose
cards or calculate rewards for planned purchases.

## Demo Mode

Demo mode uses local sample wallet records with supported Rewardly card IDs. It
exists only to reduce first-use friction for beta testing.
