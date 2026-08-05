# Decision Reason Codes

Reason codes are stable public values that allow clients to render explanations without reconstructing decision logic.

## Primary Reason Codes

| Code                                | Meaning                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `MERCHANT_RULE_WON`                 | A merchant-specific rule contributed to the winning recommendation.    |
| `CATEGORY_RULE_WON`                 | A category-level rule contributed to the winning recommendation.       |
| `STATEMENT_CREDIT_WON`              | A statement credit or offer contributed to the winning recommendation. |
| `BASE_REWARD_RULE_WON`              | A base earning rule contributed to the winning recommendation.         |
| `HIGHEST_CONFIDENCE_ADJUSTED_VALUE` | The selected card produced the best confidence-adjusted value.         |
| `NO_ELIGIBLE_RECOMMENDATION`        | Rewardly could not recommend an eligible payment method.               |

## Supporting Reason Codes

| Code                  | Meaning                                           |
| --------------------- | ------------------------------------------------- |
| `SUPPORTING_EVIDENCE` | Additional evidence supported the primary reason. |

## Tradeoff and Alternative Codes

| Code                       | Meaning                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `ALTERNATIVE_LOWER_VALUE`  | An alternative was considered but offered lower estimated value.              |
| `LOWER_ESTIMATED_VALUE`    | The alternative lost because estimated value was lower.                       |
| `LOWER_REWARD_RATE`        | The alternative lost because the reward rate was lower.                       |
| `LOWER_CONFIDENCE`         | The alternative lost because confidence was lower.                            |
| `LOWER_RANKED_ALTERNATIVE` | The alternative was ranked below the selected card by canonical tie-breakers. |

## Warning Codes

| Code                            | Meaning                                           |
| ------------------------------- | ------------------------------------------------- |
| `LOW_CONFIDENCE`                | Rewardly has limited confidence in the decision.  |
| `PURCHASE_AMOUNT_UNAVAILABLE`   | Purchase amount was unavailable or estimated.     |
| `LOW_RECOMMENDATION_CONFIDENCE` | Internal decision confidence was low.             |
| `UNKNOWN_WALLET_CONFIDENCE`     | Some wallet benefit state confidence was unknown. |

## Assumption Codes

| Code                         | Meaning                                           |
| ---------------------------- | ------------------------------------------------- |
| `USER_WALLET_SCOPE`          | Rewardly evaluated only cards in the user wallet. |
| `COMMERCIAL_BIAS_DISABLED`   | No sponsored or affiliate weighting was applied.  |
| `PURCHASE_CATEGORY_PROVIDED` | The client supplied a purchase category.          |
| `PURCHASE_CATEGORY_INFERRED` | Rewardly inferred a purchase category.            |
