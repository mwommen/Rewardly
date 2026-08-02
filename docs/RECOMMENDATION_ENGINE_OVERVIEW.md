# Recommendation Engine Overview

The recommendation engine ranks cards based on structured benefit and reward rules.

It considers:

- Wallet-owned cards only.
- Merchant-specific benefits.
- Portal rules.
- Category rewards.
- Base earning.
- Enrollment, activation, expiration, and exhausted benefit state.
- Merchant classification confidence.
- Benefit confidence and data freshness.

The public API does not contain scoring logic. It calls the canonical `PaymentDecisionService`, which coordinates existing wallet, merchant, benefit, and validation services.

## Determinism

Given the same merchant, purchase, wallet, benefit data, and wallet state, Rewardly should return the same recommendation.

## Explanation Integrity

The recommendation narrative must be derived from the winning rule. If a narrative does not match the selected rule, Rewardly falls back to a safe explanation based on the actual winning evidence.
