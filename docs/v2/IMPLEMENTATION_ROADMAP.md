# Implementation Roadmap

## Sprint 9.1: Core Platform Boundary

Goal: wrap current recommendation engine behind a B2B internal interface.
Customer value: stable engine contract without scoring changes.
Scope: `PaymentDecisionEngine` interface, B2B input/result types, adapter from current service, compatibility tests.
Non-goals: tenants, public API, billing.
Acceptance: same scenarios produce same winners/explanations as current engine.
Risk: accidentally changing output.
Artifact: engine boundary doc/types.
Next decision: inline wallet request shape.

## Sprint 9.2: Multi-Tenant Foundation

Scope: organization, environment, API keys, tenant context, hashed keys, isolation tests.
Acceptance: test/live key formats work and cross-tenant access fails.

## Sprint 9.3: External Decision API

Scope: `POST /v1/payment-decisions`, validation, stable errors, request IDs, idempotency, usage records.
Acceptance: cURL returns decision using inline wallet.

## Sprint 9.4: Developer Sandbox

Scope: test API key, request builder, raw request/response, code samples, recent decisions.
Acceptance: first successful call under 20 minutes.

## Sprint 9.5: Partner Operations

Scope: key management, request logs, error logs, usage, low-confidence queue, decision replay.
Acceptance: support can debug a partner decision without raw secrets.

## Sprint 9.6: Design Partner Readiness

Scope: docs, security review packet, rate limits, production env, pilot runbook, support workflow.
Acceptance: one design partner can begin sandbox integration.

## Six-Week Acceleration

Week 1: complete blueprint, freeze consumer roadmap, select ICP, start outreach, finalize draft API.
Week 2: Sprint 9.1, begin interviews, demo current engine.
Week 3: Sprint 9.2/9.3 start, API mock, continue interviews.
Week 4: finish decision API, sandbox alpha, first design-partner technical review.
Week 5: partner scenarios, logs/replay, decision-quality review.
Week 6: pilot readiness, pricing decision, go/no-go for live beta.

Likely slips: sandbox polish, partner dashboard, persisted wallets, live deployment hardening.
