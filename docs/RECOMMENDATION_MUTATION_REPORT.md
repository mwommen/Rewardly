# Recommendation Mutation Report

Mutation score: 10/10

| Mutation | Killed | Scenarios | Killed By |
| --- | --- | ---: | --- |
| allow-non-owned-global-card-to-win | PASS | 2 | dining-001:cash-equivalent value matches within tolerance<br>dining-001:dining-001: wallet-only invariant<br>dining-001:wallet integrity: every evaluated card is owned |
| ignore-benefit-expiration | PASS | 2 | rotating-after-quarter-001:cash-equivalent value matches within tolerance<br>rotating-after-quarter-001:winner benefit matches expected<br>rotating-after-quarter-001:winner card matches expected |
| ignore-activation-requirement | PASS | 2 | gas-not-activated-001:cash-equivalent value matches within tolerance<br>gas-not-activated-001:winner benefit matches expected<br>gas-not-activated-001:winner card matches expected |
| ignore-enrollment-requirement | PASS | 1 | statement-credit-not-enrolled-001:cash-equivalent value matches within tolerance<br>statement-credit-not-enrolled-001:winner benefit matches expected<br>statement-credit-not-enrolled-001:winner card matches expected |
| ignore-cap-exhaustion | PASS | 2 | gas-cap-exhausted-001:cash-equivalent value matches within tolerance<br>gas-cap-exhausted-001:winner benefit matches expected<br>gas-cap-exhausted-001:winner card matches expected |
| use-wrong-point-valuation | PASS | 1 | dining-001:cash-equivalent value matches within tolerance |
| reverse-reward-value-sorting | PASS | 2 | dining-001:cash-equivalent value matches within tolerance<br>dining-001:explanation contains "American Express Gold Card"<br>dining-001:winner benefit matches expected |
| prefer-base-over-higher-category-rule | PASS | 3 | dining-001:cash-equivalent value matches within tolerance<br>dining-001:winner benefit matches expected<br>dining-001:winner card matches expected |
| wallet-array-order-final-tie-break | PASS | 2 | tie-base-001:winner benefit matches expected<br>tie-base-001:winner card matches expected |
| runner-up-explanation-returned | PASS | 2 | dining-001:explanation names winning card before runner-up<br>statement-credit-full-001:explanation names winning card before runner-up |
