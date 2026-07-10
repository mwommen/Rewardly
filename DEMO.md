# Rewardly Demo Runbook

## Objective

Test the Rewardly Chrome extension locally without needing a real Amazon checkout.

The local harness proves the core MVP moment:

1. User has cards in their wallet.
2. User reaches an Amazon-like payment page.
3. Rewardly detects checkout.
4. Rewardly calls the shared payment decision service.
5. Rewardly shows one card recommendation.
6. User dismisses the popup and continues shopping.

## Start Backend

Start MongoDB locally, then seed cards and demo wallet data:

```bash
cd backend
npm run seed
npm run seed:demo
```

Start the API:

```bash
cd backend
npm run dev
```

Expected API base:

```text
http://localhost:5001
```

## Start Frontend

In a second terminal:

```bash
cd frontend-vite
npm run dev
```

Expected frontend URL:

```text
http://localhost:5173
```

If Vite chooses another port, use that port in the demo URLs below.

## Load Unpacked Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the local `extension` folder.
5. After every extension code change, click Reload on the Rewardly extension card.

## Configure Extension

Open the Rewardly extension popup.

Set:

```text
API Base: http://localhost:5001
User ID: devUser
```

Add cards for local testing. Recommended:

- Amex Platinum
- Chase Freedom Unlimited
- Capital One Venture X

Click Save wallet.

## Open Demo Checkout

Open:

```text
http://localhost:5173/demo-checkout-amazon.html
```

Expected result:

- Rewardly popup appears near the bottom-right of the page.
- Popup shows one best card.
- Popup includes Why, Estimated Rewards, Benefits, and Dismiss.
- Clicking Dismiss hides the popup.

## Test Cases

### 1. Popup Appears On Checkout / Payment Page

Open:

```text
http://localhost:5173/demo-checkout-amazon.html
```

Expected:

- Popup appears within about one second after the page is ready.
- Popup recommends one card from the wallet configured in the extension.
- Popup does not show dashboards, charts, tables, or extra cards.

### 2. Popup Does Not Appear On Cart Page

Open:

```text
http://localhost:5173/demo-amazon-cart.html
```

Expected:

- No Rewardly popup appears.
- This page contains cart language but no payment form or order summary.

### 3. Popup Does Not Appear On Confirmation Page

Open:

```text
http://localhost:5173/demo-amazon-confirmation.html
```

Expected:

- No Rewardly popup appears.
- Confirmation pages are intentionally suppressed.

### 4. Dismiss Hides Popup For 30 Minutes

1. Open `demo-checkout-amazon.html`.
2. Wait for the popup.
3. Click Dismiss.
4. Refresh the same checkout page.

Expected:

- Popup stays hidden for the same checkout context.
- To reset manually, clear site data for `localhost` or run this in DevTools:

```js
Object.keys(localStorage)
  .filter((key) => key.startsWith("rewardly-dismiss:"))
  .forEach((key) => localStorage.removeItem(key));
```

### 5. Duplicate Popup Does Not Appear For Same Checkout Context

1. Open `demo-checkout-amazon.html`.
2. Wait for the popup.
3. Leave the popup open.
4. Interact with the page or wait for DOM updates.

Expected:

- Only one Rewardly popup exists.
- The extension does not stack duplicate popups.

## Optional Lululemon Demo

The previous benefit-specific demo still exists:

```text
http://localhost:5173/demo-checkout-lululemon.html
```

Use this when testing the Amex Platinum Lululemon credit. The Amazon harness is the primary local test for the extension-first checkout moment.

## Troubleshooting

If no popup appears:

- Confirm backend is running on `http://localhost:5001`.
- Confirm frontend is running on the URL you opened.
- Confirm the extension was reloaded after code changes.
- Confirm the extension popup has `API Base` set to `http://localhost:5001`.
- Confirm cards are selected in the extension popup.
- Refresh the demo checkout page after saving wallet settings.
- Clear dismissal state if you recently clicked Dismiss.

## Guardrails

- Do not add product features to the test harness.
- Do not change recommendation logic for the harness.
- The harness exists only to verify the extension checkout moment locally.
