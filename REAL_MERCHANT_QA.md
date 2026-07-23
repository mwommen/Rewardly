# Rewardly Real Merchant QA Checklist

Use this checklist when testing the unpacked extension on a real merchant site.
Start with Amazon before adding more merchants.

## Setup

1. Start the backend.
2. Start the frontend if local demo pages are also being checked.
3. Load the unpacked extension from the local `extension/` folder.
4. Open the extension popup.
5. Set `API Base` to the backend you are testing, for example
   `http://localhost:5001`.
6. Set `User ID` to a test user, for example `manualTestUser`.
7. Add one known card to the demo wallet, for example Amex Platinum.
8. Enable debug logs.
9. Open DevTools Console on each merchant tab.

For local manual wallet testing, start the backend with:

```bash
REWARDLY_ALLOW_DEV_OVERRIDES=true npm run dev
```

For private beta, leave development overrides off and configure:

```text
REWARDLY_BETA_SESSION_TOKEN=<server issued token>
REWARDLY_BETA_USER_ID=<server mapped beta user>
```

Then save the matching beta session token in the extension popup. This is a
small private-beta identity mechanism, not production authentication.

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
REWARDLY_API_BASE=http://localhost:5001 \
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

## Manifest Coverage

The extension currently injects the content script only for:

```json
"matches": [
  "http://localhost/*",
  "https://amazon.com/*",
  "https://www.amazon.com/*",
  "https://smile.amazon.com/*",
  "https://www.lululemon.com/*",
  "https://shop.lululemon.com/*",
  "https://checkout.lululemon.com/*"
]
```

If `content-script-loaded` is missing on a checkout page, reload the unpacked
extension, refresh the checkout tab, and confirm the site is not a restricted
browser page such as `chrome://`.
