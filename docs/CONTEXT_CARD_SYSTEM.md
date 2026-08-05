# Context Card System

Context Cards are reusable mobile UI units for personal payment guidance.

## Model

Each card supports:

- `id`
- `kind`
- `title`
- `explanation`
- `primaryAction`
- `secondaryAction`
- `icon`
- `priority`
- `expiresAt`
- `metadata`

## Current Card Types

- `wallet_empty`
- `nearby_smart_pay`
- `shopping_plan`
- `wallet_coach`
- `recent_decision`
- `weekly_progress`
- `smart_pay`

## UX Rules

- One clear action per card.
- Short copy.
- No internal scoring terms.
- No card benefit calculations in the client.
- Context cards can expire when the guidance is no longer timely.

## Accessibility

Cards include accessible labels, large touch targets, high-contrast text, and button roles for interactive controls.
