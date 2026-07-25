# Payment Decision Detector Coverage Audit

Date: 2026-07-24

## Purpose

Rewardly should trigger when a shopper reaches a real payment decision, not when a supported merchant is merely detected. The detector is organized around reusable checkout capabilities:

- route signals
- visible payment controls
- visible payment-step labels
- saved payment selectors
- express checkout options
- hosted payment iframes
- billing/shipping controls
- order summary and total context
- checkout progress
- post-purchase confirmation suppression

Merchant detection and payment-stage detection remain separate.

## Supported Pattern Matrix

| Pattern | Universal Capability | Expected Result |
| --- | --- | --- |
| Standard card form | card number, expiration, CVV, billing controls | trigger |
| Saved card selector | saved card/payment method control plus checkout context | trigger |
| Express checkout options | Apple Pay, PayPal, Klarna, Google Pay, Shop Pay | trigger |
| Dynamically revealed payment section | user interaction or DOM attribute mutation triggers reevaluation | trigger after selection |
| Custom radio/tile selector | role/aria/data/class payment controls | trigger |
| Same-origin iframe payment form | iframe content can be inspected | trigger |
| Cross-origin iframe metadata fallback | iframe src/name/title/aria/id indicates payment/card | trigger with lower confidence support |
| SPA route transition | URL polling and DOM mutation reevaluation | trigger after checkout state appears |
| Accessible shadow DOM controls | open shadow roots are traversed by universal selectors | trigger |
| Guest checkout | shipping form with order summary and checkout progress | trigger at checkout stage |
| Signed-in checkout | saved payment evidence plus order context | trigger |
| Cart-only page | cart/order summary/total without payment controls | suppress |
| Review with place-order but no payment controls | review evidence without payment evidence | suppress |
| Confirmation page | thank-you/order-placed route or text | suppress |

## Missing Pattern Matrix

| Pattern | Current Status | Limitation |
| --- | --- | --- |
| Closed shadow DOM payment controls | not directly inspectable | browser does not expose closed shadow contents |
| Cross-origin iframe internals | metadata only | browser security prevents reading frame DOM |
| Merchant uses image-only payment controls without accessible labels | weak | needs accessible text, aria, title, id/class, or iframe metadata |
| Extension not injected by manifest host permissions | blocked before detection | detector cannot run unless Chrome injects the content script |
| Payment selection handled entirely inside native browser/payment sheet | limited | page DOM may not expose enough evidence |

## Architecture Changes

- Review-stage triggering now requires payment decision evidence. Place Order plus total is not enough.
- The content script observes relevant attribute changes, not just added/removed nodes.
- User interactions on payment-like controls schedule faster reevaluation.
- Universal selector scanning includes accessible custom controls and payment tiles.
- Universal selector scanning traverses open shadow roots.
- Same-origin iframe scanning reuses the same selector path.
- Cross-origin iframe support is limited to iframe metadata.

## Observability

Debug logs include:

- detected stage
- detected signals
- confidence score
- HIGH threshold
- trigger decision
- suppression reason
- whether a recommendation request was sent

Key logs:

- `[Rewardly] checkout-detected`
- `[Rewardly] checkout-signal-summary`
- `[Rewardly] Waiting for checkout`
- `[Rewardly] recommendation-requested`

## Merchant-Specific Logic Boundary

This audit did not add Domino's-specific selectors, routes, domains, merchant records, or recommendation logic. The new coverage tests use random/example hostnames and assert the detector falls back to the generic profile while still detecting payment-stage intent.

Existing merchant profiles remain for already-supported beta merchants and legacy route quirks, but the new payment-decision coverage is generic.

## Validation

- Generic detector fixtures cover 13 payment-flow patterns.
- Representative merchant fixtures still cover Amazon, Lululemon, Target, Walmart, Apple, and Best Buy.
- Cart-only and confirmation suppression remain covered.
