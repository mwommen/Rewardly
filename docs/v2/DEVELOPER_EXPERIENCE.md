# Developer Experience

## Target Journey

1. Developer reads concise docs.
2. Creates sandbox organization or receives design-partner sandbox.
3. Gets `rw_test_` API key.
4. Chooses sample wallet.
5. Sends sample payment decision.
6. Sees recommendation, alternatives, confidence, warnings, and trace.
7. Copies cURL/JavaScript/Python.
8. Views recent request logs.
9. Reads error guidance.
10. Requests live/design-partner access.

## Time To First Valid Call

Target: under 20 minutes for a developer using docs and sandbox.

## Sandbox Scope

Must use real `/v1/payment-decisions` contract. It should allow sample wallet, merchant, amount, channel, raw request, raw response, formatted result, confidence, applied rules, code samples, and reset.

## Reference Integration

Recommendation: web sandbox plus Chrome extension reference. The extension demonstrates real-time checkout use, but the web sandbox demonstrates B2B API value faster.
