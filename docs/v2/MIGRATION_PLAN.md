# Migration Plan

## Stage 1: Freeze Consumer Expansion

No new consumer features, broad merchant expansion, mobile app, or public extension launch.

Exit: founder confirms extension is reference client.

## Stage 2: Stabilize Core Engine

Define engine interface, preserve regression tests, map pure domain packages.

Exit: B2B input can evaluate without consumer auth.

## Stage 3: Add Tenant Boundary

Organization, environment, API key, tenant context, tests.

Exit: all new records tenant-scoped.

## Stage 4: External API Facade

Versioned `/v1/payment-decisions`, validation, errors, idempotency, usage.

Exit: sandbox can call API.

## Stage 5: Sandbox

Interactive request builder using real API.

Exit: developer gets first valid call in under 20 minutes.

## Stage 6: Partner Operations

Decision logs, key management, usage, low-confidence queue, replay.

Exit: support can debug pilot requests.

## Stage 7: Design Partner

Real partner workflow, production hardening, pilot metrics.

Exit: first paid-pilot decision.

## Decommissioning

Consumer signup: keep temporarily for reference.
Beta invite model: preserve for reference only.
Wallet website: migrate to sandbox/dashboard.
Extension connection: preserve for reference.
Checkout popup: preserve as demo.
Consumer analytics/feedback: generalize or retire.
Local demo pages: keep as test fixtures.
