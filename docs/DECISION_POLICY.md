# Decision Policy

Decision Policy tells Rewardly how a decision should be optimized.

Policies are context, not recommendation logic.

## Supported Policies

- `balanced`
- `maximize-cash-back`
- `maximize-travel-rewards`
- `minimize-complexity`
- `debt-avoidance`

## Product Principle

Rewardly optimizes for the user's best confidence-adjusted financial outcome.

Policy changes what matters. Decision Infrastructure still determines what wins.

## Examples

`balanced` balances reward value, confidence, simplicity, and useful protections.

`minimize-complexity` tells Rewardly that a lower-effort recommendation may be preferable when value is close.

`debt-avoidance` makes financial well-being a first-order context input.

## Future Work

Policy can later influence scoring explicitly once product rules are validated. EPIC-015 only introduces canonical policy input and metadata consumption.
