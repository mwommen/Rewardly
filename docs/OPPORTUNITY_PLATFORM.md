# Rewardly Opportunity Intelligence Platform

Ticket #010 adds a proactive financial guidance layer to Rewardly.

The recommendation engine still answers:

`What card should I use?`

The opportunity platform answers:

`What should I do next?`

## Opportunity Architecture

Opportunity intelligence is independent from recommendation scoring. It consumes wallet benefit state, recommendation context, and future behavior signals, then produces guidance objects that clients can display.

Core components:

- Canonical Opportunity model
- Modular detection rules
- Prioritization framework
- Duplicate suppression
- Timeline generator
- Deterministic simulation
- Structured insights
- Analytics events
- CLI and API reports

## Canonical Opportunity Model

Each opportunity includes:

- `opportunityId`
- `userId`
- `opportunityType`
- `priority`
- `estimatedValue`
- `expirationDate`
- `confidence`
- `title`
- `summary`
- `recommendation`
- `supportingEvidence`
- `actionRequired`
- `status`

Statuses:

- `active`
- `completed`
- `dismissed`
- `expired`
- `ignored`
- `archived`

## Detection Rules

Initial modular rule types:

- Unused monthly credit
- Unused annual credit
- Quarterly category ending
- Benefit expiring soon
- Spend threshold progress
- Welcome bonus progress
- Companion pass progress
- Free night progress
- Elite status progress
- Anniversary benefits
- Retention opportunity
- Unused lounge access
- Travel credit remaining
- Dining credit remaining
- Streaming credit remaining
- Shopping credit remaining

Rules operate on canonical wallet benefit state and do not contain issuer-specific scoring logic.

## Prioritization

Prioritization considers:

- estimated financial value
- expiration urgency
- confidence
- user impact
- historical user behavior
- recommendation frequency
- duplicate suppression

Only the highest priority opportunities are returned so users are not overwhelmed.

## Timeline

The opportunity timeline supports future dashboard surfaces with chronological events:

- monthly resets
- annual renewals
- quarterly category changes
- benefit expirations
- annual fee dates
- status expiration
- welcome bonus deadlines

## Simulation

Each opportunity can be simulated deterministically.

If ignored:

- estimated value lost
- credits forfeited
- points missed
- status delayed

If completed:

- estimated value gained
- projected rewards
- milestones unlocked

Simulation output includes a deterministic hash for regression testing.

## Recommendation Integration

Checkout recommendations can include opportunity context such as:

- `$14 dining credit remaining`
- `Monthly credit expires soon`
- `Completing this purchase may use this credit`

This context does not change recommendation ranking. It only enriches the presentation model.

## Analytics

Opportunity analytics events include:

- opportunities created
- completed
- ignored
- expired
- dismissed
- estimated value saved
- estimated value lost
- detection accuracy
- average time to completion

These events are structured for future personalization, but the engine does not currently learn from them.

## CLI Commands

Run from `backend/`:

```bash
npm run opportunity:list
npm run opportunity:timeline
npm run opportunity:simulate
npm run opportunity:report
npm run opportunity:test
npm run opportunity:benchmark
```

Each command returns structured JSON for engineering review.

## API

Mounted under `/api`:

- `GET /opportunities`
- `GET /opportunities/timeline`
- `POST /opportunities/simulate`
- `GET /opportunities/report`

The current routes use deterministic fixtures until saved wallet benefit state is connected to production persistence.

## Future Personalization

Future work can use:

- dismissed opportunity types
- completed opportunity types
- recommendation frequency
- time to completion
- detection accuracy
- saved or lost value

Personalization should tune prioritization and suppression, not recommendation scoring.

## Known Limitations

- The initial API uses fixture wallet states.
- No dashboard UI was added.
- No issuer-specific opportunity logic was added.
- No recommendation ranking changes were made.
- Opportunity analytics are modeled but not wired to a third-party provider.
