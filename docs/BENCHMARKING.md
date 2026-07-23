# Recommendation Benchmarking

Ticket 007 adds a deterministic benchmarking platform for Rewardly recommendation quality.

The goal is to make recommendation quality measurable. Rewardly should be able to compare engine versions, detect regressions, and identify weak merchant, wallet, benefit, and confidence areas without relying on manual testing.

## Architecture

Core implementation:

- `backend/src/services/recommendationBenchmarkService.ts`
- `backend/src/recommendationBenchmarkCli.ts`
- `backend/tests/recommendationBenchmarkService.test.ts`

Integration point:

- `backend/src/services/recommendationService.ts`

The recommendation service accepts a `cardsOverride` snapshot for benchmarks. This lets the benchmark runner execute the existing scoring engine against deterministic fixture data without using the database.

## Scenario Design

`RecommendationBenchmarkScenario` includes:

- scenario ID
- category
- merchant
- merchant category
- purchase amount
- purchase context
- user wallet
- wallet state
- benefit snapshot
- expected winning card
- expected benefit
- expected reward value
- expected confidence range
- explanation expectations
- notes

Scenarios are deterministic. No random data generation is used.

Current categories include:

- restaurants
- groceries
- travel
- flights
- hotels
- gas
- streaming
- Amazon
- retail
- drugstores
- rotating categories
- multiple benefit conflicts
- spend cap scenarios
- expired benefits
- unknown merchant
- low confidence
- wallet state missing
- merchant alias
- parent merchant
- billing descriptor

The fixture library contains base scenarios and deterministic generated variants so the suite can scale beyond 100 scenarios while remaining reproducible.

## Runner

`runRecommendationBenchmarks()` executes scenarios against the current recommendation engine.

For each scenario it records:

- winning card
- winning benefit
- expected vs actual result
- reward difference
- confidence difference
- explanation quality
- execution time
- replay result
- pass/fail

`runBenchmarkScenario()` is available for focused debugging.

## Scoring Metrics

`RecommendationAccuracyMetrics` includes:

- recommendation accuracy
- confidence calibration
- merchant resolution accuracy
- wallet resolution accuracy
- benefit selection accuracy
- replay consistency
- explanation completeness
- benchmark pass rate

These are engineering metrics. They should guide investigation, not force product behavior by themselves.

## Regression Detection

`detectBenchmarkRegressions()` identifies:

- recommendation regressions
- confidence regressions
- benefit regressions
- replay failures

Regression examples:

- a previously passing scenario starts failing
- the winner changes away from the expected card
- confidence drops materially
- replay no longer matches
- selected benefit changes away from expectation

## Confidence Calibration

`calculateConfidenceCalibration()` evaluates:

- overconfident failures
- underconfident passes
- calibration drift
- confidence distribution

The current calibration model is benchmark-based. It does not claim real-world statistical calibration yet.

## Engine Comparison

`compareBenchmarkRuns()` compares two benchmark reports:

- baseline engine
- candidate engine

It reports:

- winner changes
- average reward delta
- average confidence delta
- regressions
- improvements

This creates a safe workflow for future scoring experiments.

## Leaderboard

`buildRecommendationLeaderboard()` reports:

- most accurate categories
- lowest confidence categories
- most common failures
- frequently selected cards
- frequently selected benefits
- highest value recommendations

These reports are internal engineering tools.

## Developer Commands

Run from `backend/`:

```bash
npm run benchmark
npm run benchmark:full
npm run benchmark:merchant
npm run benchmark:wallet
npm run benchmark:compare
npm run benchmark:report
npm run benchmark:confidence
```

Each command emits structured JSON.

## Adding New Benchmarks

Add new scenarios in `recommendationBenchmarkScenarios()`.

Each new scenario should:

- use deterministic merchant, card, wallet, and benefit snapshots
- define expected winning card
- define expected benefit when relevant
- define expected value when deterministic
- include wallet state for state-required benefits
- avoid product-specific exceptions in the runner

Do not modify recommendation logic only to make a benchmark pass. A failing benchmark should either reveal an engine issue or an incorrect benchmark expectation.

## Known Limitations

- Benchmark fixtures are representative, not exhaustive real-world truth.
- Generated variants expand coverage but are based on base scenarios.
- The runner uses current engine code only; separate experimental engines are represented by comparing reports.
- Confidence calibration is benchmark-suite calibration, not production outcome calibration.
- Reports are JSON-only and intended for engineering workflows.
