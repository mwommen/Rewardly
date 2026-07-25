# Rewardly Extension Manual Test Results

## Sprint 8.4 User Feedback & Merchant Coverage

Date: 2026-07-24

This sprint added a lightweight feedback and merchant coverage system. It did not change recommendation scoring, merchant intelligence, checkout timing, analytics behavior, onboarding, or popup recommendation logic.

Validation summary:

- Feedback service tests: PASS. Covered helpful feedback, negative feedback reason validation, `other` comments, privacy rejection, merchant request normalization/deduplication, dashboard summaries, and trends.
- Feedback route tests: PASS. Covered `POST /api/feedback`, privacy rejection, summary, merchant coverage, and trends endpoints.
- Backend Jest: PASS, 49/49 suites and 379/379 tests.
- Backend build: PASS.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS for `popup.js`, `content.js`, and `background.js`.

Manual QA not covered:

- Live extension feedback submission against a running backend.
- Live feedback dashboard API inspection against deployed beta data.
- Screen-reader pass through the feedback controls.

## Sprint 8.3 First-Time User Experience

Date: 2026-07-24

This sprint added a first-time onboarding and setup experience to the website. It did not change recommendation scoring, merchant intelligence, checkout timing, analytics behavior, or the extension popup.

Validation summary:

- Frontend build: PASS.
- Frontend lint: PASS.
- Extension syntax checks: PASS for `popup.js`, `content.js`, and `background.js`.
- Local render check: PASS at `http://127.0.0.1:5173/`.
- Screenshot artifact: `artifacts/rewardly-sprint-8-3-onboarding.png`.

Manual QA covered:

- Welcome copy renders.
- Setup checklist renders.
- Browser validation states render.
- Demo recommendation merchant buttons render.
- Supported merchant categories render.
- Desktop viewport has no horizontal overflow.

Manual QA not covered:

- Fresh Chrome Web Store install.
- Real missing-permission browser state.
- Screen-reader pass with VoiceOver.

## Sprint 8.2 Polish Product Intelligence Hardening

Date: 2026-07-24

This polish sprint strengthened the analytics/product intelligence layer. It did not change recommendation scoring, merchant detection, checkout timing, or popup UX.

Validation summary:

- Analytics service tests: PASS. Covered merchant health calculation, recommendation value aggregation, version metadata, environment metadata, time-to-first-recommendation, analytics health metrics, privacy rejection, and retention cleanup.
- Analytics route tests: PASS. Covered ingestion plus summary, merchants, confidence, errors, funnel, value, and health endpoints.
- Backend Jest: PASS, 47/47 suites and 370/370 tests.
- Backend build: PASS.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS for `content.js` and `background.js`.
- Performance sanity check: PASS. 1,000 in-memory analytics events ingested in 28ms; dashboard aggregate queries completed in 4ms.

Manual QA:

- Live dashboard API verification was not run against a deployed beta environment.
- No recommendation, merchant, checkout, or popup UX behavior changed in this sprint.

## Sprint 8.2 Beta Analytics & Product Intelligence

Date: 2026-07-24

This sprint added privacy-first beta analytics and product intelligence. It did not change recommendation scoring, merchant intelligence, checkout detection, or popup recommendation logic.

Validation summary:

- Analytics service tests: PASS. Covered typed event validation, session lifecycle, funnel aggregation, merchant aggregation, confidence aggregation, error aggregation, retention cleanup, and privacy rejection.
- Analytics route tests: PASS. Covered event ingestion, sensitive metadata rejection, summary, merchants, confidence, errors, and funnel endpoints.
- Backend Jest: PASS, 47/47 suites and 366/366 tests.
- Recommendation validation: PASS, 1104/1104 scenarios.
- Merchant Intelligence validation: PASS, 1041/1041 scenarios.
- Backend build, frontend build, frontend lint, shared-core compile, and extension syntax checks: PASS.

Manual dashboard QA was not run against a live browser session in this pass. `docs/BETA_ANALYTICS.md` documents the endpoints and privacy constraints for beta testing.

## Sprint 8.1 Recommendation Trust Layer

Date: 2026-07-24

This sprint changed recommendation presentation only. It did not change recommendation scoring, selection, merchant intelligence, wallet filtering, or benefit registry behavior.

Validation summary:

- Presentation model tests: PASS. Covered trust copy, confidence labels, reward formatting, alternative comparison, unknown merchant fallback, and no-wallet empty state.
- Popup rendering checks: PASS by static screenshot artifact at `artifacts/rewardly-sprint-8-1-popup.png` and extension syntax validation.
- Accessibility checks: PASS for implemented keyboard details toggle, screen-reader dialog labels, focus management, visible focus styles, and reduced-motion CSS. Full live screen-reader QA still requires manual browser testing.
- Backend Jest: PASS, 46/46 suites and 359/359 tests.
- Recommendation validation: PASS, 1104/1104 scenarios.
- Merchant Intelligence validation: PASS, 1041/1041 scenarios.
- Backend build, frontend build, frontend lint, shared-core compile, and extension syntax checks: PASS.

Manual merchant QA for Amazon, Target, Starbucks, Lululemon, Hilton, DoorDash, unknown merchant, API failure, no wallet, low confidence, and high confidence was not rerun in a live browser during this code pass. The popup states and presentation logic were validated through automated tests and static rendering.

## Sprint 7 Merchant Intelligence and Recommendation Accuracy

Date: 2026-07-24

This sprint did not redesign the extension popup or change recommendation ranking. It added a deterministic Merchant Intelligence layer between checkout detection and the Wallet Decision Engine.

Validation summary:

- Backend Jest: PASS, 46/46 suites and 359/359 tests.
- Backend build: PASS.
- Merchant Intelligence curated/full gate: PASS, 1041/1041 scenarios, registry PASS, invariants PASS, metamorphic PASS, coverage PASS.
- Merchant Intelligence generated stress suite: PASS, 10000/10000 scenarios using seed `20260724`.
- Recommendation full gate: PASS, 1104/1104 scenarios, 12135/12135 invariants, 383/383 metamorphic checks, 10/10 mutations killed.
- Recommendation generated stress suite: PASS, 10000/10000 scenarios using seed `20260724`.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS using `../../backend/node_modules/.bin/tsc -p tsconfig.json`.
- Extension syntax checks: PASS for `extension/background.js` and `extension/content.js`.
- Intentional Merchant Intelligence CLI failures: PASS, no-match scenario and generated `--count 0` both exited nonzero.

Manual live merchant QA was not rerun in this sprint; `REAL_MERCHANT_QA.md` now contains the focused merchant-intelligence QA matrix.

## Sprint 6.5 Recommendation Validation Release Hardening

Date: 2026-07-24

This sprint did not change extension UX or checkout timing. It added release-gate validation for recommendation correctness.

Final cleanup update:

- Backend Jest: PASS, 45/45 suites and 346/346 tests.
- Full PR gate command: PASS, 1104/1104 scenarios, 12135/12135 invariants, 383/383 metamorphic checks, 10/10 mutations killed.
- Generated stress suite: PASS, 10000/10000 scenarios using seed `20260724`.
- CI summary script: PASS, renders actual report values.
- Frontend build/lint, backend build, shared-core compile, and extension syntax checks: PASS.

Final validation summary:

- Policy-level mutation suite: PASS, 10/10 required mutations killed.
- Semantic coverage gate: PASS, 0 threshold failures.
- Full recommendation validation: PASS, 1104/1104 scenarios.
- Invariants: PASS, 12135/12135.
- Metamorphic checks: PASS, 383/383.
- Generated stress suite: PASS, 10000/10000 scenarios using seed `20260724`.
- Manual extension harness: PASS, 17/17 checks.

Manual harness note: the current backend must run with `REWARDLY_ALLOW_DEV_OVERRIDES=true` for local manual wallet overrides. Beta/runtime identity remains token-gated.

## Sprint 6 Recommendation Validation Framework

Date: 2026-07-24

This sprint did not change extension UX or checkout timing. It hardened recommendation correctness validation.

Validation summary:

- Full backend Jest suite: PASS, 40/40 suites and 325/325 tests.
- Recommendation validation full suite: PASS, 1101/1101 scenarios.
- Invariants: PASS, 12102/12102.
- Metamorphic checks: PASS, 371/371.
- Mutation smoke: PASS, 10/10 representative defects detected.
- Generated stress suite: PASS, 10000/10000 scenarios using seed `20260724`.
- Frontend build/lint, backend build, shared-core compile, and extension syntax checks: PASS.

Manual checkout browser testing was not rerun for this validation-only sprint.

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

## Sprint 8.5 Private Beta Production Deployment

Date: 2026-07-24

Result: PASS for local automated validation. Real hosted beta verification remains manual.

Commands run:

```bash
npm --prefix backend run build
npm --prefix backend test -- --runInBand betaAuthService betaAuthRoutes decisionRoutes
npm --prefix backend test -- --runInBand
npm --prefix frontend-vite run build
npm --prefix frontend-vite run lint
cd packages/rewardly-core && ../../backend/node_modules/.bin/tsc -p tsconfig.json
node --check extension/background.js
node --check extension/content.js
node --check extension/popup.js
node --check extension/config.js
npm run verify:beta-production
REWARDLY_EXTENSION_API_BASE=https://rewardly-api.example.com REWARDLY_EXTENSION_APP_URL=https://rewardly.example.com npm run extension:package:beta
```

Observed totals:

- Focused beta/decision tests: PASS, 3 suites, 13 tests.
- Full backend tests: PASS, 51 suites, 386 tests.
- Backend build: PASS.
- Frontend build and lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS.
- Root beta-production verification: PASS.
- Chrome beta package content check: PASS.

Coverage added:

- Beta invite creation stores token hashes, not raw tokens.
- Activation returns a one-time session token.
- Revoked tokens cannot authenticate.
- Wallet reads and updates use the authenticated beta user.
- Spoofed wallet `userId` does not override authenticated identity.
- Payment decisions outside dev resolve the server-validated beta user and ignore manual wallet overrides.

Manual beta checks still required:

- Deployed Render `/health` and `/ready`.
- Deployed Vercel frontend using real `VITE_API_BASE_URL`.
- Atlas index initialization.
- Two isolated real beta users with different wallets.
- Chrome Web Store unlisted extension package installed with the real extension ID.

## Sprint 8.5.1 Private Beta Activation and Release Validation

Date: 2026-07-25

Result: PASS for local automated validation. Hosted activation and Chrome Web
Store installation remain founder/manual steps.

Commands run:

```bash
npm --prefix backend run build
npm --prefix backend test -- --runInBand betaAuthService betaAuthRoutes decisionRoutes
npm run verify:beta-production
```

Observed totals:

- Focused beta/decision tests: PASS, 3 suites, 17 tests.
- Full backend tests through `verify:beta-production`: PASS, 51 suites, 390 tests.
- Frontend build and lint: PASS.
- Shared core compile: PASS.
- Extension development and production syntax checks: PASS.
- Production extension package generation and inspection: PASS.

Production package:

```text
release/rewardly-extension-beta.zip
sha256: 36297b0aa07440b473fc9905d8d1ffb12d045573102130bf7096945392de9a3f
inspection report: release/rewardly-extension-beta-report.json
```

New coverage:

- Activation token creates an authenticated beta session.
- Extension connection codes are short-lived and one-time.
- Production extension uses bearer-token session from `chrome.storage.local`.
- Revoked users cannot authenticate.
- Wallet card slugs are validated against the canonical catalog.
- Unknown, malformed, and duplicate wallet slugs are rejected.
- Production package contains no Developer Settings, API Base, User ID, manual token field, debug controls, localhost, or development-user strings.
