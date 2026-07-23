# Rewardly Phase 3 Production Readiness Report

Date: 2026-07-21

## Executive Summary

Rewardly is functionally ready for a small closed beta on the existing supported scope: Chrome extension, user-selected wallet cards, Amazon/Lululemon/local checkout flows, and one checkout recommendation.

The beta should be treated as controlled, not public. The product has the core reliability protections needed for first external users: restricted extension hosts, wallet-first decisions, duplicate popup prevention, dismissal memory, checkout-stage gating, request timeouts, and now anonymous analytics instrumentation.

## Closed Beta Recommendation

Status: Ready for controlled closed beta after manual real-site spot checks.

Confidence: 82%

Risk: Medium

Primary reason: the local extension harness passes, but real merchant checkouts can change DOM structure without notice. Amazon has been validated previously; Lululemon still needs a fresh real-checkout pass after this phase.

## Bugs Fixed In Phase 3

- Added anonymous extension analytics plumbing through the background worker.
- Added installation-level event tracking without collecting personal information.
- Added sanitized analytics metadata for checkout, popup, wallet, and error lifecycle events.
- Added structured event capture for recommendation request/display/failure/timeout/dismissal.
- Added background-side wallet diff tracking for `wallet_created`, `card_added`, `card_removed`, and `wallet_empty`.
- Updated backend analytics endpoint to accept anonymous `installationId` events while remaining compatible with existing `userId` events.
- Reduced analytics coupling by routing events through a single background-worker abstraction.

## Analytics Architecture Summary

Rewardly now uses a lightweight provider-neutral analytics path:

1. Extension content script and popup emit named events.
2. Background worker owns the anonymous installation id.
3. Background worker sanitizes metadata.
4. Background worker POSTs to `/api/analytics/event`.
5. Backend stores events in `analyticsEvents`.

Anonymous identifier:

- Stored as `INSTALLATION_ID` in `chrome.storage.sync`.
- Generated with `crypto.randomUUID()` when available.
- Not tied to card numbers, emails, names, or bank credentials.

Collected metadata is intentionally limited to:

- `merchant`
- `hostname`
- `category`
- `stage`
- `hasRecommendation`
- `errorCode`
- `errorType`
- `walletCardCount`
- `popupVisible`
- `duplicateContext`
- `dismissedForMs`
- `reason`

Events currently emitted:

- `extension_installed`
- `extension_popup_opened`
- `wallet_created`
- `card_added`
- `card_removed`
- `wallet_empty`
- `wallet_load_failed`
- `merchant_detected`
- `recommendation_requested`
- `recommendation_displayed`
- `recommendation_failed`
- `recommendation_timeout`
- `recommendation_dismissed`
- `continue_checkout_clicked`
- `popup_visible`
- `popup_hidden`
- `merchant_detection_error`

Known analytics limitation:

- `unsupported_merchant_encountered` is not generally emitted because the extension no longer injects on unsupported sites. That is the correct privacy/security behavior for beta. If broader host permissions are added later, unsupported-site tracking should be added behind strict privacy review.

## Merchant Reliability Report

### Supported Beta Runtime Hosts

Current extension injection scope:

- `localhost`
- `amazon.com`
- `www.amazon.com`
- `smile.amazon.com`
- `lululemon.com`
- `www.lululemon.com`
- `shop.lululemon.com`
- `checkout.lululemon.com`

### Merchant Registry

The content script contains the runtime merchant registry used by the extension. Rewardly also has shared merchant detection logic in `packages/rewardly-core`. These are aligned enough for beta, but still duplicated.

Supported merchant names in the current registry:

- Amazon
- Lululemon
- Target
- Walmart
- Costco
- Best Buy
- Apple
- Nike
- Home Depot
- Lowe's
- DoorDash
- Uber Eats
- Starbucks
- Delta
- United
- Southwest
- Marriott
- Hilton
- Airbnb
- Expedia
- Booking.com

Important beta note:

- The manifest currently injects only on Amazon, Lululemon, and local demo hosts. The broader merchant registry exists for future support, but those merchants are not active extension hosts in this beta build.

### Merchant Checklist

Use this checklist for each merchant before enabling it in the manifest:

- Content script injects only on intended domains.
- Merchant normalizes to canonical merchant name.
- Checkout stage is detected as `payment` or `review`.
- Cart stage does not trigger popup.
- Confirmation stage does not trigger popup.
- Popup appears within one second after checkout detection.
- Popup is visible in viewport.
- Popup does not cover the final order action in a way that blocks checkout.
- Popup renders long card names and benefits without overflow.
- Only one popup appears per checkout context.
- Dismiss hides popup for 30 minutes.
- Reload preserves dismissal.
- SPA URL changes trigger re-evaluation.
- DOM mutation bursts do not starve checkout evaluation.
- Recommendation request includes normalized merchant, category, MCC, checkout stage, and amount when available.
- Recommendation result shows exactly one card.
- Recommendation is restricted to wallet-owned cards.
- Analytics events are emitted for request, display, failure, dismiss, and timeout.

### Current Merchant Status

| Merchant | Runtime Host Enabled | Harness Status | Real-Site Status | Notes |
| --- | --- | --- | --- | --- |
| Amazon | Yes | Pass | Needs periodic re-test | Local harness validates checkout/cart/confirmation/dismiss/duplicate behavior. |
| Lululemon | Yes | Local demo available | Needs fresh real-site pass | Explicit merchant mapping exists. |
| Local demo checkout | Yes | Pass | N/A | Primary automated validation path. |
| Target | No | Not run | Not enabled | Registry only. |
| Walmart | No | Not run | Not enabled | Registry only. |
| Costco | No | Not run | Not enabled | Registry only. |
| Best Buy | No | Not run | Not enabled | Registry only. |
| Apple | No | Not run | Not enabled | Registry only. |
| Nike | No | Not run | Not enabled | Registry only. |
| Home Depot | No | Not run | Not enabled | Registry only. |
| Lowe's | No | Not run | Not enabled | Registry only. |
| DoorDash | No | Not run | Not enabled | Registry only. |
| Uber Eats | No | Not run | Not enabled | Registry only. |
| Starbucks | No | Not run | Not enabled | Registry only. |
| Delta | No | Not run | Not enabled | Registry only. |
| United | No | Not run | Not enabled | Registry only. |
| Southwest | No | Not run | Not enabled | Registry only. |
| Marriott | No | Not run | Not enabled | Registry only. |
| Hilton | No | Not run | Not enabled | Registry only. |
| Airbnb | No | Not run | Not enabled | Registry only. |
| Expedia | No | Not run | Not enabled | Registry only. |
| Booking.com | No | Not run | Not enabled | Registry only. |

## QA Checklist

### Installation

- Load unpacked extension.
- Confirm extension icon opens consumer wallet popup.
- Confirm Developer Settings are collapsed by default.
- Confirm no popup appears on unsupported websites.

### Wallet Setup

- Add one card from quick picks.
- Add one card from search.
- Remove one card.
- Clear wallet.
- Close and reopen extension popup.
- Confirm wallet state persists.
- Confirm card catalog unavailable state uses consumer language.

### Merchant Detection

- Amazon cart: no popup.
- Amazon checkout/payment: popup appears.
- Amazon confirmation: no popup.
- Lululemon cart: no popup.
- Lululemon checkout/payment: popup appears.
- Lululemon confirmation: no popup if reachable.

### Popup Rendering

- Popup visible in viewport.
- Popup does not overflow horizontally.
- Long card names wrap correctly.
- Long benefit labels truncate or wrap cleanly.
- Card logo/fallback tile renders.
- Dismiss button remains visible and clickable.
- Keyboard focus is visible on dismiss.

### Recommendation Accuracy

- Wallet has Amex Platinum only: popup recommends Amex Platinum.
- Wallet has Amex Gold only: popup cannot recommend Chase/Capital One.
- Empty wallet: no recommendation popup; decision should return no-wallet response.
- Recommended merchant shown matches canonical merchant.

### Dismiss Behavior

- Click `Got it`.
- Popup disappears.
- Reload checkout page.
- Popup remains hidden for the same checkout context.
- New merchant/checkout context can still trigger later.

### Duplicate Prevention

- Trigger DOM mutations on checkout page.
- Confirm only one popup exists.
- Reload while request is in flight.
- Confirm no duplicate visible popups.

### Extension Lifecycle

- Reload extension.
- Restart browser.
- Open multiple checkout tabs.
- Confirm dismiss is scoped by checkout context.
- Confirm service worker wakes for recommendation request.

### Network And Backend

- Backend healthy: recommendation appears.
- Backend unavailable: no technical message shown to user.
- Slow backend: request times out cleanly.
- Offline mode: no user-facing technical language.
- Analytics endpoint unavailable: product continues working.

### Version Upgrade

- Install prior beta build.
- Add wallet cards.
- Upgrade extension.
- Confirm wallet data remains.
- Confirm new analytics installation id is created if missing.

## Production Readiness Review

### Critical

No known Critical blockers for a controlled closed beta.

### High

1. Real merchant DOM fragility
   - Why it matters: Amazon and Lululemon can change checkout markup without notice.
   - Recommendation: run real-site smoke tests before every beta build.

2. Merchant registry duplication
   - Why it matters: content script and shared core can drift.
   - Recommendation: bundle shared core into the extension or generate browser-ready registry from the shared package.

3. Authentication/session model remains beta-grade
   - Why it matters: private beta identity is not production authentication.
   - Recommendation: keep beta access limited; do not ship publicly until server-controlled auth/session is hardened.

### Medium

1. Analytics are write-only
   - Why it matters: beta monitoring needs a dashboard or query workflow.
   - Recommendation: create a simple internal beta analytics view or documented Mongo queries.

2. Extension still has legacy `CCO_*` message paths
   - Why it matters: unused paths increase maintenance risk.
   - Recommendation: remove after beta if not needed by current flows.

3. Local developer settings remain in extension popup
   - Why it matters: okay for beta, not Chrome Web Store production.
   - Recommendation: hide behind build flag before public release.

4. Request logs may be noisy
   - Why it matters: server logs every non-analytics API request into the analytics collection.
   - Recommendation: separate product analytics from operational request logs before scale.

### Low

1. Card logo coverage is incomplete in extension assets.
2. Analytics event names should eventually be versioned.
3. Manual QA screenshots should be archived by build number.
4. Browser coverage is currently Chrome-only.

## Remaining Launch Blockers

For closed beta:

- Fresh manual Amazon checkout spot check.
- Fresh manual Lululemon checkout spot check.
- Confirm beta token/session setup for each tester.
- Confirm backend uptime and MongoDB availability during tester window.

For public launch:

- Production authentication/session model.
- Shared registry bundling to remove duplicated merchant logic.
- Production analytics review and retention policy.
- Chrome Web Store privacy disclosures.
- Broader real-merchant test matrix.
