# Merchant Intelligence Architecture

Sprint 7 separates three responsibilities:

1. Checkout detection decides whether the shopper is at a payment decision moment.
2. Merchant Intelligence resolves who the merchant is and what purchase context applies.
3. Wallet Decision Engine chooses the best owned card from normalized context.

The Chrome extension collects only allowlisted raw signals. The backend evaluates merchant identity, context, confidence, ambiguity, and evidence through `MerchantIntelligenceService`.

The current implementation also exposes smaller merchant-intelligence modules under
`backend/src/services/merchant-intelligence/` for normalization, registry access,
candidate resolution, confidence scoring, trace sanitization, and decision-input
adaptation. These modules preserve the existing public service contract while
making the resolver easier to test and harden incrementally.

## Identity vs Context

Merchant Identity is the canonical business entity, such as Amazon, Whole Foods Market, DoorDash, or Delta Air Lines.

Merchant Context is the purchase environment, such as online direct checkout, marketplace checkout, delivery, subscription, or travel portal.

Whole Foods remains `whole-foods` with merchant family `amazon`; it is not collapsed into Amazon. Checkout providers such as Stripe or PayPal remain providers, not purchase merchants.

## Rollout

`REWARDLY_MERCHANT_INTELLIGENCE_MODE` supports:

- `legacy`: existing merchant normalization behavior.
- `shadow`: evaluate Merchant Intelligence without changing recommendation inputs.
- `merchant-intelligence`: route decision inputs through normalized merchant context.

The implementation currently defaults to shadow-compatible behavior unless `merchant-intelligence` is explicitly set.

Shadow mode is the beta default. It records Merchant Intelligence diagnostics and
parity discrepancies without making Merchant Intelligence authoritative for the
recommendation input. Set `REWARDLY_MERCHANT_INTELLIGENCE_MODE=merchant-intelligence`
only when intentionally testing the authoritative path.

## Privacy

Merchant Intelligence must not collect or persist card numbers, CVVs, customer names, addresses, emails, order numbers, cookies, tokens, full HTML, cart contents, or payment form values. Signals are capped, sanitized, and traced as summaries.

Extension decision payloads send safe URLs with query strings and fragments
removed. Backend route sanitization strips card-like numbers, emails, token-like
values, cookie/session identifiers, and control characters before payment
decision processing or diagnostics.
