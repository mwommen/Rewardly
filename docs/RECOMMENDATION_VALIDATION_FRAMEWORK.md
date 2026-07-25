# Recommendation Validation Framework

Rewardly's recommendation validation framework proves that wallet-first payment decisions stay correct as benefit data and scoring logic evolve.

## Purpose

The framework validates one core product rule:

Rewardly recommends the best card in this user's wallet, not the best card in the global catalog.

It runs deterministic scenarios through the real `WalletDecisionEngine`, captures decision traces, compares actual output with expected output, and classifies failures into actionable categories.

## Architecture

- Scenario types: `backend/src/validation/recommendationScenario.types.ts`
- Schema validation: `backend/src/validation/recommendationScenario.schema.ts`
- Scenario runner: `backend/src/validation/recommendationScenarioRunner.ts`
- Assertions: `backend/src/validation/recommendationAssertions.ts`
- Failure classification: `backend/src/validation/recommendationFailureClassifier.ts`
- Seeded generation: `backend/src/validation/recommendationScenarioGenerator.ts`
- Independent reference evaluator shim: `backend/src/validation/recommendationReferenceEvaluator.ts`
- Validation-owned reference model: `backend/src/validation/reference/`
- Invariants: `backend/src/validation/recommendationInvariants.ts`
- Metamorphic checks: `backend/src/validation/recommendationMetamorphicTests.ts`
- Policy-level mutation tests: `backend/src/validation/recommendationMutationSmoke.ts`
- Semantic coverage requirements: `backend/src/validation/recommendationCoverageRequirements.ts`
- Reports: `backend/src/validation/recommendationReport.ts`
- Registry quality checks: `backend/src/validation/benefitRegistryDataQuality.ts`

The runner calls production `evaluateWalletDecision()` and does not duplicate production ranking logic. Expected outcomes are computed by validation-owned reference modules that do not import production canonicalization, wallet usage adjustment, ranking, scoring, or reward valuation utilities.

## Scenario Schema

Each scenario defines:

- wallet user and owned cards
- purchase merchant, amount, currency, channel, and transaction date
- classification category, confidence, source, and evidence
- optional wallet benefit state
- expected winner, winning benefit, rule type, reward estimate, confidence, copy checks, and rejected rules

Scenario validation fails fast for duplicate IDs, empty wallets, unknown cards, expected winners outside the wallet, invalid dates, invalid confidence values, negative amounts, unsupported currencies, and benefit IDs that do not belong to the expected card.

## Expected Results

Curated scenarios are explicit and human-readable. Expected winners are derived from approved fixture data and a deliberately small reference evaluator, not from the production engine.

The reference evaluator owns its own explicit fixture adapter, eligibility checks, precedence handling, ranking policy, reward valuation constants, and explanation expectations.

Generated scenarios use the same independent evaluator for core rule types:

- base earning
- category multipliers
- merchant-specific multipliers or credits when fixture data exists
- issuer portal multipliers
- enrollment and activation state
- effective and expiration dates
- spending caps
- statement credits

The reference evaluator is intentionally narrower than production. Unsupported cases should stay curated until their expectation can be stated clearly.

## Curated vs Generated Tests

Curated scenarios live in `backend/tests/recommendation-validation/scenarios/` and cover dining, grocery, gas, travel, issuer portals, drugstores, streaming, general retail, rotating categories, statement credits, unknown merchants, ambiguous classification, mixed currencies, and tie breakers.

Generated scenarios are seeded and reproducible. The same seed and count produce the same IDs and expected outcomes. The framework has been exercised with 10,000 generated scenarios using seed `20260724`.

## Invariants

The framework validates:

- wallet-only behavior
- deterministic results for identical inputs
- explanation alignment with the winning rule
- confidence does not increase when classification confidence is lowered
- ineligible rules cannot win through curated cap, credit, activation, and enrollment scenarios
- wallet order independence
- winning rule belongs to the winning card
- runner-up differs from the winner when present
- finite, nonnegative reward values
- confidence scores remain between 0 and 1
- audit-log winner alignment
- rejected rules cannot also be the winning rule

## Metamorphic Checks

Current metamorphic checks use deterministic sampling rather than fixed `.slice()` coverage. They include removing the winning card, reordering wallet cards, adding an irrelevant low-value card, degrading classification confidence, changing away from issuer-portal channel, and moving the transaction date after benefit expiration.

Transforms regenerate expected outcomes from the independent reference evaluator instead of copying stale expected winners.

## Mutation Smoke

Output patching is not true mutation testing because it only proves assertions can catch corrupted completed results. Sprint 6.5 replaces that approach with policy-level mutations injected through the test-only `DecisionPolicies` seam on `evaluateWalletDecision()`.

Production calls use `defaultDecisionPolicies`. Validation mutation tests supply one intentionally defective policy at a time for eligibility, valuation, ranking, tie-breaking, candidate-card selection, or explanation generation. No environment variable, runtime setting, application startup path, or production feature can enable these mutations.

Covered required mutations:

- non-owned global card enters candidate scoring
- expired benefits remain eligible
- activation-required benefits remain eligible
- enrollment-required benefits remain eligible
- exhausted caps are valued as available
- American Express point valuation is doubled
- reward-value ordering is reversed
- base earning is preferred over stronger category rules
- wallet input order decides exact ties
- runner-up explanation is returned for the winner

Each mutation first confirms the unmutated production path passes, then reruns deterministic curated scenarios with the mutated policy. A mutation is killed only by failed scenario assertions or failed invariants, not by unrelated thrown errors. The required mutation score is `10/10`.

## Semantic Coverage Thresholds

Coverage reports include eligibility state, cap state, credit state, winning rule type, purchase channel, classification source, confidence band, wallet size, date boundaries, ranking paths, metamorphic transform execution, invariant execution, currency, and rejected-rule reasons.

Thresholds are explicit in `recommendationCoverageRequirements.ts`. Critical branches require curated coverage, including expired rules, not-yet-effective rules, missing activation, missing enrollment, exhausted cap, partial cap, exact tie, wallet reorder, non-owned card prevention, explanation alignment, portal-only eligibility, and merchant-specific mismatch.

The coverage command exits nonzero when a required branch is missing:

```bash
npm run validate:recommendations:coverage
npm run validate:recommendations:coverage -- --show-coverage-scenarios
```

## Running Locally

From `backend/`:

```bash
npm run validate:recommendations
npm run validate:recommendations:curated
npm run validate:recommendations:generated -- --seed 20260724 --count 1000
npm run validate:recommendations:full
npm run validate:recommendations:mutation
npm run validate:recommendations:coverage
npm run validate:recommendations -- --scenario dining-001
npm run validate:recommendations -- --tag grocery
npm run validate:recommendations:report
```

Generated failure reproduction:

```bash
npm run validate:recommendations -- --suite generated --seed 20260724 --scenario-index 1842
```

Validation exits nonzero when any scenario fails.

## Reports

Validation and gate commands write:

- `docs/RECOMMENDATION_VALIDATION_REPORT.json`
- `docs/RECOMMENDATION_VALIDATION_REPORT.md`
- `docs/RECOMMENDATION_COVERAGE_REPORT.json`
- `docs/RECOMMENDATION_COVERAGE_REPORT.md`
- `docs/RECOMMENDATION_MUTATION_REPORT.json`
- `docs/RECOMMENDATION_MUTATION_REPORT.md`

Reports separate curated correctness, generated validation, coverage, mutation smoke, and known unsupported cases. Generated pass rates are validation-suite health metrics, not real-world merchant accuracy.

## Regression Corpus Policy

When a real recommendation bug is found, add the smallest deterministic scenario that reproduces it under `backend/tests/recommendation-validation/scenarios/` and tag it with `regression`. If the case comes from generated validation, preserve its seed and `scenario-index` in the scenario notes or reproduction command before fixing the engine.

Use the explicit promotion helper only after a generated scenario is reproduced as failing:

```bash
npm run validate:recommendations:promote-regression -- \
  --seed 20260724 \
  --scenario-index 418 \
  --issue REWARDLY-123
```

The helper refuses to promote currently passing scenarios and refuses to overwrite existing files. It writes a deterministic draft with issue metadata, original seed, generator index, discovered date, failure category, unresolved expected-behavior placeholder, and a `fixedByCommit` placeholder.

## GitHub Actions Gate

`.github/workflows/recommendation-validation.yml` runs on pull requests to `main`, pushes to `main`, manual dispatch, and a nightly schedule.

Pull requests run backend clean install, backend tests, backend build, and one full recommendation validation command:

```bash
npm run validate:recommendations:full -- --seed 20260724 --count 1000 --report
```

That single full command enforces scenario assertions, invariants, metamorphic checks, mutation score, semantic coverage thresholds, and registry-quality checks while writing validation, coverage, and mutation reports. The workflow no longer reruns the same 1,000 generated scenarios and mutation suite through separate curated/generated/coverage/mutation steps. The 10,000 generated suite remains separate for pushes to `main`, manual dispatch, and nightly schedule because it is useful release evidence but does not need to slow every pull request.

The workflow uploads validation, coverage, mutation reports, generated failure artifacts, and CI summary source data with `if: always()`. The Actions summary is generated by `backend/scripts/write-recommendation-ci-summary.ts` from actual JSON reports. Missing reports render `Unavailable` rather than static success-looking values.

Generated validation failures are written under `backend/validation-output/failures/` as deterministic JSON artifacts containing scenario ID, seed, generator index, full scenario input, expected result, actual normalized result, failed assertions, failure categories, and reproduction command. These artifacts are for diagnosis only; permanent regression files are created only through the explicit promotion command.

## Reviewing Failures

A failed scenario includes:

- expected winner and benefit
- actual winner and benefit
- failed assertions
- failure categories
- full decision trace
- rejected-rule reasons
- reproduction command

Use failure categories to route investigation:

- `wrong_winner`, `wrong_benefit`, `wrong_rule_precedence`: scoring or precedence
- `reward_calculation`, `cap_handling`, `credit_handling`: value computation
- `wallet_state`, `enrollment_handling`, `activation_handling`: wallet state
- `classification`, `confidence`: purchase or merchant classification
- `explanation`: narrative integrity
- `registry_data`: fixture or benefit data quality

## Benefit Registry Quality

The framework also checks fixture registry data for:

- missing base earning rules
- duplicate benefit IDs
- invalid effective-date ranges
- missing source metadata
- missing verification timestamps
- missing reward units
- caps without periods
- credits without reset periods
- category rules without categories
- merchant-specific rules without merchant matchers

## Current Fixture Coverage

The controlled validation fixture includes approved records for:

- American Express Gold
- Chase Sapphire Preferred
- Chase Freedom Flex
- Capital One Venture
- Citi Custom Cash
- Citi Double Cash
- Wells Fargo Autograph
- Wells Fargo Active Cash
- a controlled statement-credit offer card

Known missing flagship records for this validation set:

- American Express Platinum
- American Express Blue Cash Preferred
- Chase Sapphire Reserve
- Chase Freedom Unlimited
- Capital One Venture X
- Capital One Savor or equivalent
- Citi Strata Premier

Those are documented data gaps. The framework does not invent issuer terms to fill them.

## Core Rule

Codex and this validation framework may verify engine behavior against approved rules, but they are not the authority for whether issuer benefit terms are factually current. Benefit factuality still requires issuer-source review and promotion through Rewardly's benefit intelligence process.

## Known Limitations

- The reference evaluator intentionally supports only core rule types.
- Live issuer data freshness is not validated.
- Real checkout DOM behavior is out of scope.
- Cross-origin iframe limitations belong to extension checkout detection tests.
- Cardmember-year reset behavior is not modeled in the current fixture data.
