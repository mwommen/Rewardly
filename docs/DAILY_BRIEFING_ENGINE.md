# Daily Briefing Engine

The Daily Briefing engine is a lightweight mobile orchestration layer.

## Responsibility

It determines which existing platform outputs should appear first on the home screen.

It does not:

- Recommend cards
- Score benefits
- Classify merchants
- Duplicate backend intelligence
- Add machine learning

## Inputs

- Wallet cards
- Wallet Coach snapshot
- Payment Journey entries
- Shopping Plans
- Nearby merchants
- Favorite merchants
- Location permission state

## Output

The engine returns:

- `headline`
- `subheadline`
- ranked Context Cards
- empty state
- generated timestamp

## Deterministic Priority

The ranking is fixed and explainable. Empty wallet guidance wins first. Active shopping plans and nearby Smart Pay opportunities rank above progress summaries. Default Smart Pay remains available when no richer context exists.

## Performance

The engine is pure and synchronous. It runs from cached hook data and does not add network requests.
