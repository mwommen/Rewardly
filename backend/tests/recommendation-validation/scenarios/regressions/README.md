# Recommendation Regression Scenarios

Add a focused scenario here when a real recommendation bug is found.

Each regression should include:

- the smallest wallet that reproduces the failure
- the purchase classification and confidence evidence
- the expected winning card and rule
- the original failure source, seed, or `scenario-index` when applicable
- the `regression` tag

Regression scenarios should test recommendation correctness only. Checkout DOM and extension timing regressions belong in the extension or checkout-detection test suites.
