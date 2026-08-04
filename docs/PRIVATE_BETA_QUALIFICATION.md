# Rewardly Private Beta Qualification

Rewardly's private-beta qualification suite answers one question:

```text
Is this repository safe enough to begin private beta testing?
```

It does not deploy Rewardly, publish the Chrome extension, or claim real merchant
checkout behavior has been tested.

## Commands

Full qualification:

```bash
npm run qualify:private-beta
```

Quick qualification:

```bash
npm run qualify:private-beta:quick
```

View the latest report:

```bash
npm run qualify:private-beta:report
```

## Dependencies

Install dependencies first:

```bash
cd /path/to/rewardly
npm ci
cd backend && npm ci
cd ../frontend-vite && npm ci
```

The root runner uses the backend and frontend lockfiles. It does not require a
production database or real Plaid credentials.

## Reports

The suite writes:

```text
artifacts/private-beta-qualification.json
artifacts/private-beta-qualification.md
artifacts/production-route-matrix.md
artifacts/extension-package-report.md
artifacts/merchant-fixture-coverage.md
```

The JSON report is machine-readable. The Markdown report is founder-readable.

## Categories

- Dependency Preflight
- Repository Safety
- Build
- Authentication
- Wallet Isolation
- Recommendation Correctness
- Merchant Detection
- Extension Syntax
- Frontend Activation Contract
- Popup Lifecycle Contract
- Analytics
- Feedback
- Production Route Contracts
- CORS Runtime Policy
- Logging Redaction
- Extension Package
- Orchestrated Beta Flow
- Full Backend Regression Suite
- Performance

## Integrity Rules

Sprint 8.6A.1 tightened the suite so a passing category describes the exact work
that ran.

- `Extension Syntax` is syntax-only and no longer claims popup lifecycle behavior.
- `Frontend Activation Contract` is a source contract until a frontend DOM test
  stack is installed.
- `Popup Lifecycle Contract` is a source contract until a JSDOM or browser
  lifecycle harness is installed.
- `Orchestrated Beta Flow` runs a dedicated two-user beta scenario instead of
  merely running all backend tests.
- `Extension Package` runs the production package script and independently scans
  the generated ZIP contents.
- Reports are repository-portable and include schema version, runner version,
  commit, CI flag, dependency preflight result, and manual boundaries.

## Critical Versus Warning

Critical failures return:

```text
PRIVATE BETA QUALIFICATION: NOT READY
```

Warnings are used for boundaries that are real but not locally automatable, such
as hosted route probing or real Chrome Web Store installation.

## Status Rules

`READY` means all critical automated checks passed.

`NOT READY` means at least one critical automated check failed.

The report may include warnings even when the final status is `READY`.

## CI

`.github/workflows/private-beta-qualification.yml` runs the suite on pull
requests to `main`, manual dispatch, and pushes to the private-beta branch. It
uploads qualification reports as artifacts. It does not deploy or publish.

## Troubleshooting

- If dependencies are missing, run `npm ci` in `backend` and `frontend-vite`.
- If the package check fails, inspect `artifacts/extension-package-report.md`.
- If recommendation tests fail, fix the engine or data, not the popup copy.
- If safety scan fails, remove committed secrets or unsafe production values.

## Manual Testing Still Required

See `docs/MANUAL_PRIVATE_BETA_TESTS.md`.
