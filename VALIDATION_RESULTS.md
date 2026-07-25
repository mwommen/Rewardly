# Rewardly Correctness Validation Results

## Sprint 8.4 User Feedback & Merchant Coverage

Date: 2026-07-24

Status: PASS. This sprint adds lightweight structured feedback and merchant coverage reporting without changing recommendation logic, merchant intelligence, checkout detection, analytics behavior, onboarding, or recommendation scoring.

What changed:

- Added `FeedbackService` for helpful feedback, negative feedback, and merchant support requests.
- Added privacy validation for comments and structured feedback fields.
- Added conservative merchant normalization and deduplication for support requests.
- Added `POST /api/feedback`, `GET /api/feedback/summary`, `GET /api/feedback/merchants`, and `GET /api/feedback/trends`.
- Added feedback dashboard aggregates: helpful rate, not-helpful rate, common issue, confidence versus feedback, requested merchants, and coverage by category.
- Added optional checkout popup feedback UI with Yes/No and structured negative reasons.
- Added request-support action for no-recommendation merchant coverage gaps.
- Added extension background feedback transport with anonymous installation correlation and extension version.
- Added documentation in `docs/USER_FEEDBACK_AND_MERCHANT_COVERAGE.md`.

Final local gate results:

- Focused feedback tests: PASS, 2/2 suites and 9/9 tests.
- Backend Jest: PASS, 49/49 suites and 379/379 tests.
- Backend build: PASS.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS for `popup.js`, `content.js`, and `background.js`.

Privacy note: feedback does not store card numbers, purchase totals, order details, payment information, customer names, addresses, tokens, cookies, or full URLs with sensitive query parameters. Optional free text is limited to 250 characters and rejected when sensitive patterns are detected.

Manual QA note: live extension feedback submission and dashboard API verification were not run against a deployed beta environment.

## Sprint 8.3 First-Time User Experience

Date: 2026-07-24

Status: PASS. This sprint adds a polished onboarding/setup experience for new users without changing recommendation logic, merchant intelligence, checkout detection, analytics behavior, or the extension popup.

What changed:

- Added a welcome experience explaining what Rewardly does, when it works, and what setup does next.
- Added a setup checklist for wallet, extension verification, browser permissions, demo test, and ready state.
- Added browser setup validation for extension detection, session readiness, wallet availability, and checkout permissions.
- Added a supported merchant overview grouped by category instead of a large merchant list.
- Added a demo recommendation launcher for Amazon, Target, Starbucks, Hilton, and DoorDash using the existing search/recommendation flow.
- Added clear empty/fix states for missing wallet, missing extension, and missing permissions.
- Added responsive onboarding styling with accessible labels, focus behavior inherited from the design system, and no horizontal overflow in the render check.

Final local gate results:

- Frontend build: PASS.
- Frontend lint: PASS.
- Extension syntax checks: PASS for `popup.js`, `content.js`, and `background.js`.
- Local render check: PASS at `http://127.0.0.1:5173/`.
- Screenshot artifact: `artifacts/rewardly-sprint-8-3-onboarding.png`.

Testing note: the frontend project does not currently include a dedicated UI/unit test runner. Validation was performed with TypeScript build, ESLint, extension syntax checks, and Playwright render inspection.

## Sprint 8.2 Polish Product Intelligence Hardening

Date: 2026-07-24

Status: PASS. This sprint hardens the beta analytics layer without changing recommendation scoring, merchant intelligence, checkout detection, or user experience.

What changed:

- Added typed `recommendation_acknowledged` infrastructure without emitting it from non-deliberate actions.
- Added aggregate recommendation value metrics: average displayed reward value, average advantage over runner-up, value distribution, and reward type distribution.
- Added merchant health scoring based on success rate, unknown merchant rate, confidence, latency, recommendation failures, and extension communication failures.
- Added version metadata: extension version, recommendation engine version, and merchant registry version.
- Added environment metadata: browser family and operating system family only.
- Added aggregate time-to-first-recommendation measurement from install to first successful recommendation.
- Added analytics health metrics for received/rejected events, privacy failures, failed writes, cleanup duration, dashboard query latency, and event processing latency.
- Strengthened privacy validation for order/payment identifiers and full URLs with sensitive query strings.
- Updated analytics documentation with lifecycle, schema, privacy guarantees, merchant health, value metrics, health metrics, and dashboard endpoints.

Final local gate results:

- Focused analytics tests: PASS, 2/2 suites and 13/13 tests.
- Backend Jest: PASS, 47/47 suites and 370/370 tests.
- Backend build: PASS.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS for `background.js` and `content.js`.
- Analytics performance sanity check: PASS, 1,000 in-memory events ingested in 28ms and dashboard aggregate queries completed in 4ms.

Privacy note: analytics still stores product telemetry only. It does not store card numbers, purchase amounts, order totals, order IDs, payment identifiers, addresses, emails, cookies, tokens, raw request payloads, full sensitive URLs, or browser history.

Manual QA note: live dashboard API verification was not run against a deployed beta environment.

## Sprint 8.2 Beta Analytics & Product Intelligence

Date: 2026-07-24

Status: PASS. This sprint adds a privacy-first beta analytics pipeline without changing recommendation scoring, merchant intelligence, or checkout detection.

What changed:

- Added `RecommendationAnalyticsService` as the centralized typed analytics pipeline.
- Normalized legacy extension events into allowlisted event types.
- Added session IDs, confidence bands, recommendation latency, popup latency, merchant classification latency, details-opened, retry-clicked, and popup lifecycle telemetry.
- Added privacy validation that rejects card numbers, emails, phone numbers, addresses, tokens, cookies, and purchase totals before storage.
- Added retention cleanup with configurable `REWARDLY_ANALYTICS_RETENTION_DAYS`.
- Added development/opt-in dashboard APIs: `/summary`, `/merchants`, `/confidence`, `/errors`, and `/funnel`.
- Added documentation in `docs/BETA_ANALYTICS.md`.

Final local gate results:

- Backend Jest: PASS, 47/47 suites and 366/366 tests.
- Backend build: PASS.
- `npm run validate:recommendations:full -- --seed 20260724 --count 1000 --report`: PASS, 1104/1104 scenarios, 12135/12135 invariants, 383/383 metamorphic checks, 10/10 mutations killed, 0 coverage failures.
- `npm run validate:merchant-intelligence:full -- --seed 20260724 --count 1000 --report`: PASS, 1041/1041 scenarios, registry PASS, invariants PASS, metamorphic PASS, parity PASS, privacy PASS, performance PASS.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS for `background.js` and `content.js`.

Privacy note: analytics stores product telemetry only. It does not store card numbers, purchase amounts, order totals, addresses, emails, cookies, tokens, raw request payloads, or browser history.

## Sprint 8.1 Recommendation Trust Layer

Date: 2026-07-24

Status: PASS. This sprint adds a presentation-only trust layer for payment recommendations without changing recommendation scoring or selection.

What changed:

- Added presentation-ready trust copy to `generateRecommendationPresentation`.
- Added user-facing confidence labels such as `Excellent Match`, `High Confidence`, `Good Match`, `General Recommendation`, and `Limited Confidence`.
- Added reward display formatting, optional cash-equivalent display, alternative-card comparison copy, and details-panel content.
- Redesigned the checkout recommendation popup to consume backend presentation strings.
- Added empty and error popup states with consumer-safe language.
- Added keyboard-accessible details expansion, focus handling, visible focus states, and reduced-motion handling.
- Captured popup screenshot artifact: `artifacts/rewardly-sprint-8-1-popup.png`.

Final local gate results:

- Backend Jest: PASS, 46/46 suites and 359/359 tests.
- Backend build: PASS.
- `npm run validate:recommendations:full -- --seed 20260724 --count 1000 --report`: PASS, 1104/1104 scenarios, 12135/12135 invariants, 383/383 metamorphic checks, 10/10 mutations killed, 0 coverage failures.
- `npm run validate:merchant-intelligence:full -- --seed 20260724 --count 1000 --report`: PASS, 1041/1041 scenarios, registry PASS, invariants PASS, metamorphic PASS, parity PASS, privacy PASS, performance PASS.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS for `background.js` and `content.js`.

Recommendation logic note: this sprint only changes presentation generation and popup rendering. Existing recommendation validation remained green after the changes.

## Sprint 7 Merchant Intelligence and Recommendation Accuracy

Date: 2026-07-24

Status: PASS. This sprint adds deterministic Merchant Intelligence between checkout detection and payment recommendation.

What changed:

- Added Merchant Identity versus Merchant Context evaluation.
- Added evidence, candidate, confidence, ambiguity, marketplace, checkout-provider, trace, and registry-version outputs.
- Added safe extension merchant-signal collection and backend sanitization.
- Integrated Merchant Intelligence into the payment decision flow behind `REWARDLY_MERCHANT_INTELLIGENCE_MODE`.
- Added Merchant Intelligence validation CLI commands and reports.
- Added registry quality validation, semantic coverage, invariants, metamorphic tests, seeded generated scenarios, and intentional CLI failure behavior.

Final local gate results:

- Backend Jest: PASS, 46/46 suites and 355/355 tests.
- Backend build: PASS.
- `npm run validate:merchant-intelligence:full -- --seed 20260724 --count 1000 --report`: PASS, 1041/1041 scenarios, registry PASS, invariants PASS, metamorphic PASS, parity PASS, privacy PASS, performance PASS, 0 coverage failures.
- `npm run validate:merchant-intelligence:generated -- --seed 20260724 --count 10000`: PASS, 10000/10000 scenarios.
- `npm run validate:merchant-intelligence:curated`: PASS, 41/41 scenarios.
- `npm run validate:merchant-intelligence:registry`: PASS.
- `npm run validate:merchant-intelligence:coverage -- --seed 20260724 --count 1000`: PASS.
- `npm run validate:merchant-intelligence:parity`: PASS.
- `npm run validate:merchant-intelligence:privacy`: PASS.
- `npm run validate:merchant-intelligence:performance -- --seed 20260724 --count 1000`: PASS, 1000/1000 scenarios.
- `npm run validate:recommendations:full -- --seed 20260724 --count 1000 --report`: PASS, 1104/1104 scenarios, 12135/12135 invariants, 383/383 metamorphic checks, 10/10 mutations killed, 0 coverage failures.
- `npm run validate:recommendations:generated -- --seed 20260724 --count 10000`: PASS, 10000/10000 scenarios.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS using the installed backend TypeScript binary.
- Extension syntax checks: PASS for `background.js` and `content.js`.
- Intentional Merchant Intelligence CLI failures: PASS.

Dependency note: exported zip files intentionally exclude `node_modules`; install dependencies after unzipping before rerunning validation.

## Sprint 6.5 Recommendation Validation Release Hardening

Date: 2026-07-24

Status: PASS. This sprint adds release-gate infrastructure:

- Policy-level mutation tests now inject defective decision policies into the real `WalletDecisionEngine` path instead of patching completed outputs.
- Required mutation score is `10/10` killed.
- Semantic coverage thresholds are enforced by `npm run validate:recommendations:coverage`.
- CI release gate is defined in `.github/workflows/recommendation-validation.yml` and now uses one full validation command on pull requests.
- GitHub Actions summaries are generated from actual JSON report values.
- Generated validation failures write deterministic artifacts under `backend/validation-output/failures/`.
- Regression promotion is explicit through `npm run validate:recommendations:promote-regression`.
- Merchant/category mismatch coverage now credits the specific branch that actually appears in the trace.

Final local gate results after `backend/npm ci`:

- Backend Jest: PASS, 45/45 suites and 346/346 tests.
- Backend build: PASS.
- `npm run validate:recommendations:full -- --seed 20260724 --count 1000 --report`: PASS, 1104/1104 scenarios, 12135/12135 invariants, 383/383 metamorphic checks, 10/10 mutations killed, 0 coverage threshold failures.
- `npm run validate:recommendations:report`: PASS, report generated with 1104/1104 passing.
- `npm run validate:recommendations:generated -- --seed 20260724 --count 10000`: PASS, 10000/10000 generated scenarios.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS.
- Extension syntax checks: PASS for `background.js` and `content.js`.
- CI summary script: PASS, actual values rendered from JSON reports.

Dependency note: exported zip files intentionally exclude `node_modules`. After unzipping elsewhere, install dependencies before rerunning validation.

## Sprint 6 Recommendation Validation Framework Hardening

Date: 2026-07-24

Status: PASS after `backend/npm ci` and against the currently installed frontend/shared workspace dependencies.

### What Changed

- Replaced the recommendation reference evaluator with validation-owned reference modules under `backend/src/validation/reference/`.
- Removed production benefit canonicalization from validation scenario schema checks.
- Added deterministic generated-scenario validation, coverage summaries, stronger invariants, expanded metamorphic transforms, and mutation smoke tests.
- Added a persistent regression-corpus folder and documented promotion process.
- Expanded JSON/Markdown recommendation validation reporting.

### Validation Results

- Focused recommendation validation Jest tests: PASS, 2 suites, 13 tests.
- Full backend Jest suite: PASS, 40 suites, 325 tests.
- `npm run validate:recommendations:full`: PASS, 1101/1101 scenarios, 12102/12102 invariants, 371/371 metamorphic checks, 10/10 mutation smoke detections, 0 coverage threshold failures, 0 registry quality errors.
- `npm run validate:recommendations:generated -- --seed 20260724 --count 10000`: PASS, 10000/10000 generated scenarios.
- Backend build: PASS.
- Frontend build: PASS.
- Frontend lint: PASS.
- Shared core compile: PASS using the installed backend TypeScript binary because `packages/rewardly-core` does not have local package dependencies installed.
- Extension syntax checks: PASS for `extension/background.js` and `extension/content.js`.

### Dependency Note

`npm ci` was run successfully in `backend` before the required backend validation commands. Exported zip files intentionally exclude `node_modules`; after unzipping elsewhere, run the relevant install commands before rerunning validation.

Date: 2026-07-23

## Amazon

- detected checkout: PASS, local Amazon checkout fixture classified as review, HIGH confidence, should trigger.
- recommended card: Capital One Venture Rewards.
- winning rule: catch_all_reward, `capital-one-venture:catch_all_reward`.
- integrity result: PASS, `recommendationIntegrity.valid = true`.
- exact popup explanation: `Earn 2x Venture Miles on this Amazon purchase.`
- exact `$32.51` API reward detail: `About 65 Venture Miles on this $32.51 purchase.`
- structured reward details: `rate = 2`, `unit = miles_per_dollar`, `programName = Venture Miles`, `estimatedQuantity = 65.02`.
- normalized reward: `type = miles`, `earningRate = 2`, `earningUnit = miles_per_dollar`, `programName = Venture Miles`.
- four-block popup fields: `earningText = 2x Venture Miles`, `estimatedRewardText = About 65 Venture Miles on this $32.51 purchase.`, `reasonText = Highest verified earning rate among the eligible cards in your wallet.`
- unrelated benefits absent: PASS. Popup text did not include Capital One Travel credit, airport benefits, or generic card benefits.
- pass/fail: PASS.

Rendered popup text:

```text
REWARDLY
READY BEFORE YOU PAY
Amazon
CO
USE THIS CARD
Capital One Venture Rewards
YOU'LL EARN
2x Venture Miles
ESTIMATED REWARDS
About 108 Venture Miles on this $54.23 purchase.
WHY IT'S BEST
Highest verified earning rate among the eligible cards in your wallet.
Continue checkout with confidence.
Got it
```

## Lululemon

- detected checkout: PASS, local Lululemon checkout fixture classified as review, HIGH confidence, should trigger.
- recommended card: Capital One Venture Rewards.
- winning rule: catch_all_reward, `capital-one-venture:catch_all_reward`.
- integrity result: PASS, `recommendationIntegrity.valid = true`.
- exact popup explanation: `Earn 2x Venture Miles on this Lululemon purchase.`
- remained visible for 30 seconds: PASS.
- duplicate popup absent: PASS.
- pass/fail: PASS.

Rendered popup text:

```text
REWARDLY
READY BEFORE YOU PAY
Lululemon
CO
USE THIS CARD
Capital One Venture Rewards
YOU'LL EARN
2x Venture Miles
ESTIMATED REWARDS
About 156 Venture Miles on this $78 purchase.
WHY IT'S BEST
Highest verified earning rate among the eligible cards in your wallet.
Continue checkout with confidence.
Got it
```

## Real Merchant Dry Run

Not executed in this environment because it requires a signed-in browser session on real merchant checkout pages. The local extension harness validates the same extension pipeline against Amazon and Lululemon checkout fixtures using the patched backend.

## Commands

- `npm test -- --runTestsByPath tests/paymentDecisionService.test.ts` from `backend`: PASS, 17/17 tests.
- `npm run build` from `backend`: PASS.
- `../../backend/node_modules/.bin/tsc -p tsconfig.json` from `packages/rewardly-core`: PASS.
- `npm test` from `backend`: PASS, 249/249 tests.
- `npm run build` from `frontend-vite`: PASS.
- `npm run lint` from `frontend-vite`: PASS.
- `node --check extension/content.js`: PASS.
- `node --check extension/background.js`: PASS.
- `API_BASE=http://localhost:5025 MANUAL_CARD_SLUGS=capital-one-venture EXPECTED_CARD_PATTERN=Venture EXPECTED_EXPLANATION_PATTERN='2x Venture Miles' node scripts/manual-extension-test.js`: PASS, 17/17 harness checks.

Direct endpoint verification:

```sh
curl -s -X POST http://localhost:5025/api/decisions/payment \
  -H 'Content-Type: application/json' \
  -d '{"merchant":"Amazon","userId":"manualTestUser","manualCardSlugs":["capital-one-venture"],"amount":32.51,"url":"http://localhost:5173/demo-checkout-amazon.html","restrictToWallet":true}'
```

# Apple and Target Checkout Detection Investigation

Date: 2026-07-23

## Root Cause

Apple and Target were already present in merchant normalization, but the extension runtime allowlist still only injected on Amazon, Lululemon, and local harness pages. On real Apple and Target pages, the content script did not execute, checkout detection was never evaluated, merchant normalization never ran in the page runtime, and no payment decision request was sent.

After enabling injection for Apple and Target, the universal detector also needed two small checkout-signal improvements:

- Apple `/shop/bag` can expose a real payment decision through visible express checkout controls.
- Target can use abbreviated `/co-*` checkout routes and saved-payment selectors instead of raw card-number fields.

## Before / After Confidence

| Scenario | Before | After |
| --- | --- | --- |
| Apple real page injection | content script not injected | content script eligible on Apple domains |
| Target real page injection | content script not injected | content script eligible on Target domains |
| Apple `/shop/bag` ordinary bag | cart, 0.65, suppressed | cart, 0.65, suppressed |
| Apple `/shop/bag` with visible express checkout | cart, 0.65, suppressed | payment, 0.89, HIGH, triggers |
| Target `/co-payment` with saved payment evidence | below threshold, suppressed | payment, 0.85, HIGH, triggers |

## Commands

- `npm test -- --runTestsByPath tests/checkoutDetection.test.ts tests/merchantDetectionService.test.ts` from `backend`: PASS, 73/73 tests.
- `npm run build` from `backend`: PASS.
- `../../backend/node_modules/.bin/tsc -p tsconfig.json` from `packages/rewardly-core`: PASS.
- `npm run build` from `frontend-vite`: PASS.
- `npm run lint` from `frontend-vite`: PASS.
- `node --check extension/content.js`: PASS.
- `node --check extension/background.js`: PASS.

## Screenshots

Real Apple and Target checkout screenshots were not captured in this environment because those flows require live browser sessions and, for Target checkout, account/cart state. Manual live-site verification is still required after reloading the unpacked extension.

# Merchant-Agnostic Payment Decision Detector

Date: 2026-07-23

## Root Cause

Best Buy and Walmart failed for two reasons:

- The extension allowlist did not include Best Buy or Walmart domains, so the content script could not inject on those live payment pages.
- The universal detector was still too dependent on explicit card-number fields, hosted payment iframes, or checkout routes. Real payment pages can present the decision as semantic UI such as "Payment Information", "How do you want to pay?", saved-card selectors, PayPal, Apple Pay, Klarna, or credit/debit card option controls.

No Best Buy-specific or Walmart-specific checkout detector was added. The fix is a merchant-agnostic payment-decision model based on visible payment-stage labels, selectable payment options, express payment controls, saved-payment evidence, order totals, and checkout progress.

## Confidence Scoring

The global HIGH threshold remains `0.85`.

Payment-stage score now includes:

- visible card/payment form: `0.84`
- hosted payment iframe: `0.62`
- saved payment method: `0.52`
- express checkout control: `0.72`
- visible payment-stage label: `0.42`
- visible payment option control: `0.38`
- billing controls: `0.14`
- order total/order summary: `0.15`
- checkout progress: `0.10`
- payment label + option synergy: `0.12`
- checkout route weight: merchant profile default `0.08`

Negative suppression still wins for product/search/browsing pages, cart-only pages, sign-in pages, and post-purchase confirmation pages.

## Before / After

| Scenario | Before | After |
| --- | --- | --- |
| Best Buy live payment page | content script not injected; no payment request | payment, HIGH, triggers |
| Walmart live payment page | content script not injected; no payment request | payment, HIGH, triggers |
| Best Buy fixture with payment label/options/express/order total | below reliable payment intent model | `>= 0.85`, triggers |
| Walmart fixture with saved payment/payment label/options/order total | below reliable payment intent model | `>= 0.85`, triggers |
| Unknown merchant with clear payment-stage UI | merchant recognition still too coupled to confidence | generic merchant, payment, HIGH, triggers |
| Generic cart-only page | suppressed | suppressed |
| Confirmation page | suppressed | suppressed |

## Commands

- `npm test -- --runTestsByPath tests/checkoutDetection.test.ts tests/merchantDetectionService.test.ts` from `backend`: PASS, 76/76 tests.
- `npm test` from `backend`: PASS, 255/255 tests.
- `npm run build` from `backend`: PASS.
- `../../backend/node_modules/.bin/tsc -p tsconfig.json` from `packages/rewardly-core`: PASS.
- `npm run build` from `frontend-vite`: PASS.
- `npm run lint` from `frontend-vite`: PASS.
- `node --check extension/content.js`: PASS.
- `node --check extension/background.js`: PASS.

## Manual Verification Still Required

Reload the unpacked extension and retest live Best Buy and Walmart payment pages. In debug logs, confirm:

- `[Rewardly] content-script-loaded`
- merchant detected or fallback merchant created
- checkout confidence is HIGH
- payment-stage signals include payment label/options, saved payment, express checkout, hosted iframe, or payment form evidence
- recommendation request is sent
- popup renders once and remains dismissed after dismissal

# Recommendation Narrative Specificity and Cart Timing Regression

Date: 2026-07-23

## Root Causes

The generic popup copy came from the extension display contract, not the scoring engine. The backend Recommendation Integrity Validator can reject a mismatched narrative and return a backend-owned corrected fallback narrative, but the content script only trusted narratives when `recommendationIntegrity.valid === true`. When `fallbackApplied === true`, the extension discarded the corrected narrative and displayed generic safe fallback text such as "Verified wallet rewards" and "Calculated after checkout total".

The Best Buy early-trigger regression was caused by cart-only pages being too easy to mistake for payment intent when they had order totals and generic checkout/payment language. The detector now has an explicit cart-only regression fixture proving an order summary and total are not enough without visible payment controls.

## Before / After API Payload Shape

Before, the backend could return a corrected narrative while the extension still ignored it:

```json
{
  "decisionNarrative": {
    "headline": "Earn 2x Venture Miles on this Apple purchase.",
    "earningText": "2x Venture Miles"
  },
  "recommendationIntegrity": {
    "valid": false,
    "fallbackApplied": true
  }
}
```

The popup treated that as missing narrative and rendered generic fallback copy.

After, the extension uses any backend-owned `decisionNarrative`, including validator-generated fallback narratives. For a known Venture base rule with amount:

```json
{
  "decisionNarrative": {
    "headline": "Earn 2x Venture Miles on this Apple purchase.",
    "earningText": "2x Venture Miles",
    "estimatedRewardText": "About 2423 Venture Miles on this $1211.65 purchase.",
    "reasonText": "Highest verified earning rate among the eligible cards in your wallet.",
    "reward": {
      "type": "miles",
      "programName": "Venture Miles",
      "earningRate": 2,
      "earningUnit": "miles_per_dollar",
      "purchaseAmount": 1211.65,
      "estimatedRewardQuantity": 2423.3
    }
  },
  "recommendationIntegrity": {
    "valid": true,
    "expectedRuleId": "capital-one-venture:catch_all_reward"
  }
}
```

For a known Venture base rule without a reliable amount:

```json
{
  "decisionNarrative": {
    "headline": "Earn 2x Venture Miles on this Amazon purchase.",
    "earningText": "2x Venture Miles",
    "estimatedRewardText": "Estimated miles will update when Rewardly can read the final total.",
    "reasonText": "Highest verified earning rate among the eligible cards in your wallet."
  }
}
```

## Tests Added / Updated

- Pipeline-level Apple + Capital One Venture test proves the reusable 2x base rule produces specific narrative copy.
- Missing-amount Venture test now expects specific earning text plus non-fabricated estimated-reward copy.
- Best Buy cart-only fixture proves order summary and total alone do not trigger.
- Existing validator tests still cover merchant rewards, category bonuses, statement credits, catch-all rewards, intentionally mismatched explanations, and true unknown reward fallback.

## Commands

- `npm test -- --runTestsByPath tests/checkoutDetection.test.ts tests/paymentDecisionService.test.ts` from `backend`: PASS, 72/72 tests.
- `npm test` from `backend`: PASS, 257/257 tests.
- `npm run build` from `backend`: PASS.
- `../../backend/node_modules/.bin/tsc -p tsconfig.json` from `packages/rewardly-core`: PASS.
- `npm run build` from `frontend-vite`: PASS.
- `npm run lint` from `frontend-vite`: PASS.
- `node --check extension/content.js`: PASS.
- `node --check extension/background.js`: PASS.

## Merchant-Specific Benefit Code

No Apple, Walmart, or Best Buy-specific benefit rule was added. The specific communication comes from the reusable Capital One Venture catch-all reward rule.

# Dynamic Custom Payment Selector Detection

Date: 2026-07-23

## Root Cause

Random-merchant testing exposed a reusable payment-decision detection gap. Some checkout flows reveal payment options through custom controls instead of standard card inputs. Selection can update attributes such as `aria-checked`, `aria-selected`, `class`, `data-state`, or `data-selected` without adding enough new DOM nodes to produce a reliable checkout reevaluation.

The old observer watched child-list mutations only. It could miss payment-method selection changes that only changed attributes. The old payment-option scanner also looked at a narrow set of controls and did not consistently read accessible labels, selected custom radio buttons, payment tiles, or iframe metadata.

## Reusable Fix

- MutationObserver now watches relevant attributes that custom payment selectors commonly update.
- User interactions on payment-like controls schedule a near-immediate reevaluation.
- Payment-option detection now recognizes custom radio buttons, role-based buttons/options, selected controls, saved-payment tiles, cash/card/gift-card choices, and payment-related `aria-label`, `title`, `data-testid`, `id`, and class metadata.
- Hosted payment iframe detection now inspects accessible iframe metadata when same-origin frame contents cannot be read.
- Review-stage scoring now requires payment evidence; Place Order plus order summary and total is not enough by itself.

## Before / After Signals

| State | Signals | Confidence / Trigger |
| --- | --- | --- |
| Before payment selection | contact info, order summary, total, Place Order, no payment controls | below HIGH, suppressed |
| After payment selection | payment method label, custom selected payment option, order summary, total, Place Order | HIGH, triggers |

## Scope Note

No Domino's-specific domain, route, selector, merchant, or benefit code was added. The current beta manifest still only injects on the explicit supported-domain allowlist; testing arbitrary merchants live requires a separate host-permission/product decision.

## Commands

- `npm test -- --runTestsByPath tests/checkoutDetection.test.ts` from `backend`: PASS, 55/55 tests.
- `npm test` from `backend`: PASS, 258/258 tests.
- `npm run build` from `backend`: PASS.
- `../../backend/node_modules/.bin/tsc -p tsconfig.json` from `packages/rewardly-core`: PASS.
- `npm run build` from `frontend-vite`: PASS.
- `npm run lint` from `frontend-vite`: PASS.
- `node --check extension/content.js`: PASS.
- `node --check extension/background.js`: PASS.

# Payment Decision Detector Coverage Audit

Date: 2026-07-24

## Root Cause

Recent live failures were not isolated merchant bugs. They exposed universal detector gaps around custom payment controls, dynamically revealed payment sections, attribute-only SPA updates, accessible shadow DOM, iframe-based payment UIs, and review pages that contained totals/place-order controls without actual payment decision evidence.

## Architecture Changes

- Review-stage triggering now requires payment decision evidence; Place Order plus order total is not enough by itself.
- Content-script observation now watches payment-relevant attribute changes, not just added and removed DOM nodes.
- User interactions on payment-like controls schedule prompt checkout reevaluation.
- Universal signal scanning reads visible text plus accessible metadata such as `aria-label`, `title`, `data-testid`, `id`, class, and form values.
- Universal selector scanning traverses open shadow roots.
- Same-origin iframe scanning uses the same selector path; cross-origin iframe support is limited to iframe metadata.
- Debug logging now reports confidence, threshold, trigger decision, suppression reason, and whether a recommendation request was sent.

## Supported Pattern Matrix

| Pattern | Result |
| --- | --- |
| Standard card form | HIGH, triggers |
| Saved card selector | HIGH, triggers |
| Express checkout options | HIGH, triggers |
| Dynamically revealed payment section | reevaluates and triggers after selection |
| Custom radio/tile payment selector | HIGH, triggers |
| Same-origin iframe payment form | HIGH, triggers |
| Cross-origin iframe metadata fallback | HIGH when supported by checkout context |
| SPA route transition | reevaluates and triggers after payment state appears |
| Accessible shadow DOM controls | HIGH, triggers |
| Guest checkout | HIGH at real checkout stage |
| Signed-in checkout | HIGH with saved payment evidence |
| Cart-only page | suppressed |
| Review page with place-order but no payment controls | suppressed |
| Confirmation page | suppressed |

## Known Limitations

- Closed shadow DOM cannot be inspected by browser extensions.
- Cross-origin iframe internals cannot be read; only frame metadata is available.
- Image-only payment controls without accessible labels remain weak signals.
- The detector cannot run on live merchants unless the extension manifest allows content-script injection for that host.
- Native browser/payment-sheet flows may not expose enough DOM evidence.

## Commands

- `npm test -- --runTestsByPath tests/checkoutDetection.test.ts` from `backend`: PASS, 68/68 tests.
- `npm test` from `backend`: PASS, 271/271 tests.
- `npm run build` from `backend`: PASS.
- `../../backend/node_modules/.bin/tsc -p tsconfig.json` from `packages/rewardly-core`: PASS.
- `npm run build` from `frontend-vite`: PASS.
- `npm run lint` from `frontend-vite`: PASS.
- `node --check extension/content.js`: PASS.
- `node --check extension/background.js`: PASS.

## Merchant-Specific Scope Check

No Domino's-specific domain, route, selector, merchant, or recommendation logic was added. Generic detector fixtures use non-merchant-specific hostnames and assert the generic detector path still recognizes payment-stage intent.

# Sprint 8.5 Private Beta Production Deployment

Date: 2026-07-24

## Production Blockers Addressed

- Replaced single shared production beta identity with server-side beta users, hashed tokens, and bearer-token authentication.
- Added server-owned beta wallet storage so payment decisions load cards from the authenticated user's wallet.
- Removed full MongoDB URI logging and gated decision explanation logs behind `REWARDLY_TRACE_DECISION`.
- Added production environment validation so production cannot silently use localhost, `devUser`, `manualTestUser`, or development identity overrides.
- Added strict environment-aware CORS and disabled `/api/_env` plus QA routes in production.
- Added minimal `/health` and `/ready` endpoints.
- Added Render, Vercel, Atlas, Chrome package, and founder beta-user documentation.

## Validation Commands

- `npm --prefix backend run build`: PASS.
- `npm --prefix backend test -- --runInBand betaAuthService betaAuthRoutes decisionRoutes`: PASS, 3 suites, 13 tests.
- `npm --prefix backend test -- --runInBand`: PASS, 51 suites, 386 tests.
- `npm --prefix frontend-vite run build`: PASS.
- `npm --prefix frontend-vite run lint`: PASS.
- `cd packages/rewardly-core && ../../backend/node_modules/.bin/tsc -p tsconfig.json`: PASS.
- `node --check extension/background.js`: PASS.
- `node --check extension/content.js`: PASS.
- `node --check extension/popup.js`: PASS.
- `node --check extension/config.js`: PASS.
- `npm run verify:beta-production`: PASS.
- `REWARDLY_EXTENSION_API_BASE=https://rewardly-api.example.com REWARDLY_EXTENSION_APP_URL=https://rewardly.example.com npm run extension:package:beta`: PASS.

## Chrome Beta Package Smoke Test

Generated package:

```text
release/rewardly-extension-beta.zip
sha256: eafd47ef7ac99d5df0a23f545c522d1ec756953bd8d5312fbf5d9cb843bc0ae7
```

The package validation fails if production output contains `localhost`, `127.0.0.1`, `devUser`, `manualTestUser`, `REWARDLY_BETA_SESSION_TOKEN`, or `debug=true`.

## Remaining Manual Verification

- Create real Render, Vercel, MongoDB Atlas, and Chrome Web Store unlisted resources.
- Set real `FRONTEND_ORIGIN`, `EXTENSION_ORIGIN`, `MONGO_URI`, and extension production URLs.
- Run `npm run db:init:production` against Atlas.
- Create two beta users, activate both, add different wallets, and verify payment decisions remain isolated in the deployed environment.
- Manually load or install the packaged extension and confirm Amazon/Lululemon checkout requests use `Authorization: Bearer <token>`.

# Sprint 8.5.1 Private Beta Activation and Release Validation

Date: 2026-07-25

## Root Causes Closed

- The hosted frontend had no complete activation-code flow even though the backend exposed `/api/beta/activate`.
- The production extension could hide Developer Settings but still depended on the hidden token field.
- New extension installs had no supported way to receive a beta session.
- Production extension packaging used string replacement instead of production-specific popup/background entry points.
- Wallet updates normalized slugs but did not prove catalog validation.
- `verify:beta-production` did not run package inspection and production extension checks in one command.

## Architecture Added

- Frontend beta session service with activation, verification, authenticated requests, logout, wallet loading, and extension-code creation.
- Website activation panel with clear missing/invalid/revoked/backend states.
- One-time extension connection codes created by the authenticated website and redeemed by the extension.
- Production extension popup states: not connected, connected empty wallet, ready, expired/revoked, backend unavailable.
- Production extension background entry point with authenticated bearer-token requests and no developer settings dependency.
- Catalog validation for beta wallet card slugs.

## Validation Commands

- `npm --prefix backend run build`: PASS.
- `npm --prefix backend test -- --runInBand betaAuthService betaAuthRoutes decisionRoutes`: PASS, 3 suites, 17 tests.
- `npm run verify:beta-production`: PASS.

`verify:beta-production` ran:

- Backend build.
- Full backend tests: PASS, 51 suites, 390 tests.
- Frontend build.
- Frontend lint.
- Shared core compile.
- Extension syntax checks for development and production popup/background files.
- Production extension package generation.
- Manifest validation and unsafe-content scan.

## Production Package

```text
release/rewardly-extension-beta.zip
sha256: 36297b0aa07440b473fc9905d8d1ffb12d045573102130bf7096945392de9a3f
inspection report: release/rewardly-extension-beta-report.json
```

Package inspection confirms Manifest V3, permissions `activeTab`, `scripting`, `storage`, no localhost permissions, no Developer Settings markup, no manual token UI, no debug controls, and no development user strings.

## Two-User End-To-End Coverage

Automated service/route tests cover:

- User A activation and wallet update.
- User B activation and independent wallet update.
- User A and User B wallet isolation.
- Spoofed wallet identity ignored by authenticated wallet route.
- Extension connection code creation and one-time redemption.
- Revoked users cannot authenticate.

Hosted two-user browser testing is not executed locally and still requires real Render/Vercel/Chrome Web Store resources.
