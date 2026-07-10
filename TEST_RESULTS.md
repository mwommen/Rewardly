# Rewardly Extension Manual Test Results

Date: 2026-07-08

## Environment

- Frontend: `http://localhost:5173`
- Backend used for this test: `http://localhost:5011`
- Extension: local unpacked `extension/` folder
- Test wallet user: `manualTestUser`
- Test wallet cards: `amex-platinum`
- Browser automation: `node scripts/manual-extension-test.js`

Port `5001` was already occupied during this run, so the backend was started on
`5011` and the extension `API_BASE` was set to `http://localhost:5011`.

## Manual Load Steps Confirmed

1. Start the backend.
2. Start the Vite frontend.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the local `extension` folder.
7. Configure extension storage:
   - `API_BASE`: `http://localhost:5011` for this run
   - `USER_ID`: `manualTestUser`
   - `MANUAL_CARD_SLUGS`: `["amex-platinum"]`
8. Open the demo checkout/cart/confirmation pages.

## Results

| Test | Result | Notes |
| --- | --- | --- |
| Extension content script loads | Pass | Hidden marker reported `loaded`. |
| Demo checkout page shows popup | Pass | Checkout detected as `payment`; popup appeared. |
| Popup recommends only wallet-owned card | Pass | Recommended `The Platinum Card® from American Express`; wallet contained only `amex-platinum`. |
| Duplicate popup does not appear | Pass | DOM mutation test left exactly one popup. |
| Dismiss hides popup for same checkout context | Pass | Reload after dismiss showed zero popups. |
| Demo cart page suppresses popup | Pass | Hyphenated cart URL suppressed. |
| Demo confirmation page suppresses popup | Pass | Confirmation page suppressed. |
| Real Amazon cart | Pass | Public Amazon cart loaded, detected `cart`, and suppressed popup. |
| Real Amazon checkout direct URL | Blocked | Amazon returned `Page Not Found`; checkout/payment was not reachable without a natural signed-in cart flow. |
| Natural signed-in Amazon checkout | Pending user-run | Requires the user to sign in, add an item, and navigate to checkout/payment. Added guided runner. |
| Real Amazon confirmation | Not run | Requires reachable confirmation/thank-you page, usually after a real order flow. |

## Screenshots

- Checkout popup: `test-results/rewardly-extension/demo-checkout-popup.png`
- Checkout after dismiss/reload: `test-results/rewardly-extension/demo-checkout-dismissed.png`
- Cart page no popup: `test-results/rewardly-extension/demo-cart-no-popup.png`
- Confirmation page no popup: `test-results/rewardly-extension/demo-confirmation-no-popup.png`
- Real Amazon cart dry run: `test-results/rewardly-extension/amazon-cart-real-dry-run.png`
- Real Amazon checkout dry run: `test-results/rewardly-extension/amazon-checkout-real-dry-run.png`

## Real Amazon Dry Run

Command:

```bash
node scripts/real-amazon-dry-run.js
```

### Amazon Cart

URL:

```text
https://www.amazon.com/gp/cart/view.html
```

Result: Pass.

Observed state:

- `extensionLoaded`: `loaded`
- `checkoutStage`: `cart`
- `shouldTrigger`: `false`
- `popupCount`: `0`
- Page title: `Amazon.com Shopping Cart`

Representative debug logs:

```text
[Rewardly] checkout-detected {stage: cart, shouldTriggerRecommendation: false, confidence: 0.72, url: https://www.amazon.com/gp/cart/view.html}
[Rewardly] pipeline-failed {stage: checkout-detection, reason: checkout stage does not trigger, checkoutStage: cart}
```

### Amazon Checkout

URL tested:

```text
https://www.amazon.com/gp/buy/spc/handlers/display.html?hasWorkingJavascript=1
```

Result: Blocked by merchant page state.

Observed state:

- Page title: `Page Not Found`
- `extensionLoaded`: `loaded`
- `checkoutStage`: `unknown`
- `shouldTrigger`: `false`
- `popupCount`: `0`

Representative debug logs:

```text
[Rewardly] checkout-detected {stage: unknown, shouldTriggerRecommendation: false, confidence: 0.2, url: https://www.amazon.com/gp/buy/spc/handlers/display.html?hasWorkingJavascript=1}
[Rewardly] pipeline-failed {stage: checkout-detection, reason: checkout stage does not trigger, checkoutStage: unknown}
```

Interpretation: Rewardly did not fail silently. The direct Amazon checkout URL
did not expose a real checkout/payment page, so the extension correctly avoided
showing a popup. A signed-in natural flow from cart to checkout is still needed
to validate the live payment moment on Amazon.

## Natural Amazon Checkout Test

Command:

```bash
REWARDLY_API_BASE=http://localhost:5011 \
REWARDLY_USER_ID=manualTestUser \
REWARDLY_WALLET_CARDS=amex-platinum \
node scripts/natural-amazon-checkout-test.js
```

Status: Pending user-run.

Reason: The live Amazon checkout test requires a signed-in Amazon account,
manual item selection, and navigation to payment selection. The test runner is
ready, but I did not handle Amazon credentials or operate a real account flow.

What the runner captures:

- Amazon cart state
- Amazon checkout/payment state
- Detected merchant
- Detected checkout stage
- Decision request/response logs from debug mode
- Recommended card
- Duplicate popup behavior
- Dismiss and reload behavior
- Optional confirmation/current-page state

Output files:

- `test-results/rewardly-extension/natural-amazon-checkout-result.json`
- `test-results/rewardly-extension/natural-amazon-cart.png`
- `test-results/rewardly-extension/natural-amazon-checkout.png`
- `test-results/rewardly-extension/natural-amazon-duplicate-check.png`
- `test-results/rewardly-extension/natural-amazon-after-dismiss.png`
- `test-results/rewardly-extension/natural-amazon-after-dismiss-reload.png`

## Bugs Found And Fixed

1. Backend dev server could not import `rewardly-core` through `ts-node`
   because the package was marked as ESM. Removed the package-level ESM marker
   so local CommonJS backend dev runs.
2. Checkout pages containing text like “Confirm your payment method” were being
   misclassified as confirmation pages. Confirmation detection now requires a
   confirmation URL or absence of a payment form.
3. The cart detector did not catch hyphenated demo URLs like
   `demo-amazon-cart.html`. Cart path detection now handles hyphenated cart
   URLs and suppresses cart pages unless a payment form is present.
4. Added opt-in extension debug logs for detected merchant, checkout stage,
   decision request payload, decision response, suppressed decisions, duplicate
   context, and dismissals.
5. After a signed-in Amazon checkout attempt did not show a popup, expanded
   Amazon checkout detection to recognize natural checkout/payment URL patterns
   such as `/gp/buy`, `/checkout`, `payselect`, and `spc`, plus Amazon payment
   controls like “Use this payment method.” Sign-in and cart pages remain
   suppressed.
6. Increased the extension decision timeout from `900ms` to `3000ms` so a
   slightly slow local backend does not silently prevent the popup on real
   merchant pages.
7. Phase 1 runtime hardening: replaced mutation-observer debounce with a
   non-starving throttled scheduler, added URL-change rechecks, added explicit
   extension-side Lululemon merchant detection, standardized `[Rewardly]` logs
   across content/background stages, and added a debug-only forced-render
   diagnostic.

## Phase 1 Real Checkout Root Cause Hypothesis

Most likely cause found: real merchant checkout pages mutate continuously and
do not always expose the same simple payment fields as the local harness. The
old content script used a resettable debounce, so continuous Amazon/Lululemon
checkout DOM changes could postpone evaluation. Amazon also uses checkout paths
and controls such as `/gp/buy`, `spc`, `payselect`, and “Use this payment
method” that were not fully represented in the first detector.

The current build now logs each stage with `[Rewardly]`, rechecks URL changes,
uses a throttled non-starving observer, and can force-render a debug popup to
separate rendering failures from detection/recommendation failures.

Manual real-site verification still required: Amazon and Lululemon signed-in
checkout/payment pages need to be retried with debug logs enabled. Automated
local harnesses passing are not sufficient proof for the live checkout issue.

## Payment Decision Endpoint Contract

Canonical endpoint:

```text
POST /api/decisions/payment
```

Extension request path:

```text
/api/decisions/payment
```

Backend route:

```text
backend/src/routes/decisionRoutes.ts
router.post("/decisions/payment", ...)
backend/src/server.ts
app.use("/api", decisionRoutes)
```

Runtime issue found on July 10, 2026:

```text
POST http://localhost:5001/api/decisions/payment -> 404 Cannot POST /api/decisions/payment
POST http://localhost:5011/api/decisions/payment -> 200 with decision.recommendedCard
```

Interpretation: the backend process currently listening on `5001` is stale or
not running the latest source that mounts `decisionRoutes`. The extension path
is correct; the process behind the configured API base must be restarted from
the latest backend source, or the extension `API Base` must point to the port
running the latest backend.

Valid verification command:

```bash
curl -s -i -X POST http://localhost:5011/api/decisions/payment \
  -H 'Content-Type: application/json' \
  -d '{"userId":"manualTestUser","merchant":"Amazon","hostname":"www.amazon.com","amount":54.23,"manualCardSlugs":["amex-platinum"],"restrictToWallet":true,"purchaseContext":{"surface":"extension","checkoutDetected":true,"checkoutStage":"payment"}}'
```

Expected:

```text
HTTP/1.1 200 OK
```

Response includes:

```text
decision.recommendedCard.card.slug = "amex-platinum"
decision.wallet.cardSlugs = ["amex-platinum"]
```

Invalid verification command:

```bash
curl -s -i -X POST http://localhost:5011/api/decisions/payment \
  -H 'Content-Type: application/json' \
  -d '{"userId":"manualTestUser","manualCardSlugs":["amex-platinum"]}'
```

Expected:

```text
HTTP/1.1 400 Bad Request
```

## Verification Commands

```bash
node --check extension/content.js
node scripts/manual-extension-test.js
node scripts/real-amazon-dry-run.js
node --check scripts/natural-amazon-checkout-test.js
```
