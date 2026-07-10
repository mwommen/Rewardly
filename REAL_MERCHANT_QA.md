# Rewardly Real Merchant QA Checklist

Use this checklist when testing the unpacked extension on a real merchant site.
Start with Amazon before adding more merchants.

## Setup

1. Start the backend.
2. Start the frontend if local demo pages are also being checked.
3. Load the unpacked extension from the local `extension/` folder.
4. Open the extension popup.
5. Set `API Base` to the backend you are testing, for example
   `http://localhost:5011`.
6. Set `User ID` to a test user, for example `manualTestUser`.
7. Add one known card to the demo wallet, for example Amex Platinum.
8. Enable debug logs.
9. Open DevTools Console on each merchant tab.

## Amazon Cart

URL:

```text
https://www.amazon.com/gp/cart/view.html
```

Expected:

- Extension content script loads.
- Detected merchant is Amazon.
- Detected checkout stage is `cart`.
- `shouldTriggerRecommendation` is `false`.
- No Rewardly popup appears.
- Debug log explains suppression before a decision request.

## Amazon Checkout / Payment

Use a real signed-in Amazon account with an item in cart. Navigate naturally
from cart to checkout/payment instead of using a copied checkout URL.

Guided runner:

```bash
REWARDLY_API_BASE=http://localhost:5011 \
REWARDLY_USER_ID=manualTestUser \
REWARDLY_WALLET_CARDS=amex-platinum \
node scripts/natural-amazon-checkout-test.js
```

The runner opens a persistent browser profile with the unpacked extension,
configures debug logging, and waits while you manually:

1. Sign in to Amazon.
2. Add one inexpensive item to cart.
3. Navigate from cart to checkout/payment selection.
4. Stop before placing an order.

It saves screenshots and a JSON result to:

```text
test-results/rewardly-extension/natural-amazon-checkout-result.json
```

Expected:

- Extension content script loads.
- Detected merchant is Amazon.
- Detected checkout stage is `checkout` or `payment`.
- `shouldTriggerRecommendation` is `true`.
- Decision request payload includes:
  - `merchant: "Amazon"`
  - current `hostname`
  - current `url`
  - `restrictToWallet: true`
  - wallet-owned manual card slugs from extension settings
- Decision response includes exactly one recommended wallet-owned card.
- One Rewardly popup appears.
- Reloading or DOM changes do not create duplicate popups.
- Clicking Dismiss hides the popup for the same checkout context for 30 minutes.

## Amazon Confirmation / Thank-You

Only test if reachable without placing a real order, or after a test order flow.

Expected:

- Detected stage is `confirmation`.
- `shouldTriggerRecommendation` is `false`.
- No Rewardly popup appears.

## Debug Logs To Capture

When debug logs are enabled, copy any lines beginning with:

```text
[Rewardly]
```

The important events are:

- `content-script-loaded`
- `pipeline-started`
- `merchant-detected`
- `checkout-detected`
- `recommendation-requested`
- `recommendation-received`
- `popup-rendered`
- `popup-visible`
- `pipeline-failed`
- `pipeline-failed`
- `popup-dismissed`

If checkout does not trigger, these logs should explain whether the blocker was
merchant detection, checkout-stage detection, dismissal state, duplicate context,
or backend decision response.

Expected checkout success sequence:

```text
[Rewardly] content-script-loaded
[Rewardly] pipeline-started
[Rewardly] checkout-detected
[Rewardly] merchant-detected
[Rewardly] recommendation-requested
[Rewardly] recommendation-received
[Rewardly] popup-rendered
[Rewardly] popup-visible
```

If the sequence stops, the last log usually identifies the failing stage. Any
`[Rewardly] pipeline-failed` line should be reported with its full object.

## Forced Render Diagnostic

This bypasses checkout detection and recommendation logic. Use it only with
debug logs enabled to prove whether the popup can render on the merchant page.

Open DevTools Console on the Amazon or Lululemon checkout tab and run:

```js
window.postMessage({ type: "REWARDLY_FORCE_RENDER" }, "*");
```

Expected:

- A debug-only Rewardly popup appears.
- Console shows:

```text
[Rewardly] forced-render-requested
[Rewardly] popup-rendered
[Rewardly] popup-visible
```

Interpretation:

- If forced render works but normal checkout does not, the issue is detection,
  messaging, wallet, recommendation, or dismissal.
- If forced render does not work, the issue is popup mounting, visibility, or
  merchant page styling.

## Manifest Coverage

The extension currently injects the content script with:

```json
"matches": ["<all_urls>"]
```

This covers Amazon and Lululemon checkout domains and subdomains, including:

- `https://www.amazon.com/*`
- `https://smile.amazon.com/*`
- `https://www.lululemon.com/*`
- `https://shop.lululemon.com/*`
- `https://checkout.lululemon.com/*`

If `content-script-loaded` is missing on a checkout page, reload the unpacked
extension, refresh the checkout tab, and confirm the site is not a restricted
browser page such as `chrome://`.
