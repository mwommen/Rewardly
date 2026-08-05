# Rewardly Architecture

Rewardly is an API-first Payment Intelligence Platform with first-party mobile,
web, and browser-extension clients.

## Core Boundary

The backend owns:

- Payment decisions
- Context infrastructure, decision policies, preferences, and constraints
- Trust records, evidence, explanations, confidence, and replay
- Benefit registry
- Wallet intelligence
- Merchant intelligence
- Checkout and purchase intelligence
- Financial intent orchestration
- User identity and cloud-synced user data

Clients own:

- User interface
- Local cache and offline resilience
- Calling the API

Clients do not duplicate recommendation logic.
Clients consume canonical trust artifacts instead of reconstructing decision
reasoning from raw fields.
Clients submit context, but the platform owns normalization and interpretation.

## Current Clients

- Chrome extension: real-time checkout recommendation surface
- Mobile app: Smart Pay, wallet, payment journey, planning, and preferences
- Web app: onboarding and demo surface

## Identity and User Data

Authenticated `/api/v1/me/*` routes resolve user identity from server-issued
access tokens. Wallet, journey, plans, and preferences are scoped server-side by
`userId`.
