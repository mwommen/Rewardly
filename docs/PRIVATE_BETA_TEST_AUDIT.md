# Rewardly Private Beta Test Audit

## What Already Exists

- Backend Jest suite covering recommendation scoring, payment decisions, wallet
  intelligence, benefit decision accuracy, checkout detection, merchant
  intelligence, analytics, feedback, and beta authentication.
- Deterministic recommendation validation framework with curated, generated,
  invariant, metamorphic, and mutation-smoke tests.
- Merchant and checkout fixture tests for Amazon, Lululemon, Target, Apple,
  Best Buy, Walmart, and generic payment-decision patterns.
- Frontend build and lint validation.
- Shared-core TypeScript compile.
- Extension syntax validation and deterministic production package inspection.
- Private beta deployment and security documentation.

## Reliable Release-Blocking Coverage

- Wallet-first recommendation behavior.
- Recommendation integrity and explanation correctness.
- Beta token hashing, activation, revocation, and route authentication.
- Server-owned wallet isolation and card-slug validation.
- Checkout detection false-positive prevention.
- Analytics and feedback privacy validation.
- Production extension package unsafe-content scan.

## Duplicated Or Overlapping Areas

- Recommendation correctness is covered by both service-level tests and the
  deterministic validation framework.
- Merchant detection is covered at service level and checkout fixture level.
- Beta authentication is covered by service and route tests.

## Missing Or Manual Before Sprint 8.6A

- One root qualification command with a single READY/NOT READY result.
- Founder-readable and machine-readable readiness reports.
- Production route matrix artifact.
- Extension package report artifact copied into the qualification output.
- CI workflow for private-beta qualification.

## Sprint 8.6A.1 Integrity Updates

- Added a dedicated `privateBetaQualificationFlow` backend test that executes a
  two-user beta path: invite, activation, one-time extension connection, wallet
  isolation, authenticated payment decision, feedback, analytics, revocation,
  and post-revocation access denial.
- Renamed overclaimed syntax-only checks to `Extension Syntax`.
- Reclassified frontend activation and popup lifecycle validation as contract
  checks until a DOM/browser test harness is installed.
- Added dependency preflight checks so missing installed dependencies fail before
  the runner claims qualification coverage.
- Added independent extension ZIP inspection after packaging.
- Made generated reports portable by removing absolute local repository paths.
- Added schema and runner metadata to reports to reduce stale READY confusion.

## Currently Manual

- Real Chrome Web Store review and installation.
- Real hosted Render/Vercel/Atlas validation.
- Real merchant checkout DOM behavior.
- Frontend activation DOM behavior until a frontend test stack is added.
- Popup lifecycle DOM behavior until a JSDOM/browser harness is added.
- Human trust, annoyance, and comprehension feedback.

## Can Be Automated

- Builds, lint, TypeScript, backend tests, qualification reports, route matrix,
  package inspection, source safety scanning, and extension syntax checks.

## Cannot Be Fully Automated Locally

- Chrome Web Store approval.
- Actual Amazon/Lululemon/Target/Apple/Best Buy/Walmart production DOM changes.
- Hosted latency and deployment environment correctness.
- Whether a beta tester trusts or acts on the recommendation.

## Release-Blocking Tests

- Authentication.
- Wallet isolation.
- Recommendation correctness and invariants.
- Merchant/checkout fixture behavior.
- Analytics and feedback privacy.
- Production package inspection.
- Build and TypeScript correctness.
- Source safety scan.
