jest.mock("../src/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("../src/utils/category", () => ({
  inferCategories: jest.fn((merchant: string) => {
    const value = String(merchant || "").toLowerCase();
    if (/bistro|uber eats/.test(value)) return ["restaurants"];
    if (/grocery|whole foods/.test(value)) return ["groceries"];
    if (/delta|hilton/.test(value)) return ["travel"];
    if (/netflix/.test(value)) return ["streaming"];
    if (/cvs/.test(value)) return ["drugstores"];
    if (/shell/.test(value)) return ["gas"];
    if (/amazon|costco/.test(value)) return ["online_shopping"];
    return ["other"];
  }),
}));

jest.mock("../src/utils/valuation", () => ({
  toCashEquivalent: jest.fn((unit: string, rate: number, issuer: string) => {
    if (unit === "cash") return rate / 100;
    return /american express|amex/i.test(issuer) ? rate * 0.015 : rate * 0.01;
  }),
}));

import {
  BENCHMARK_VERSION,
  calculateAccuracyMetrics,
  calculateConfidenceCalibration,
  compareBenchmarkRuns,
  detectBenchmarkRegressions,
  recommendationBenchmarkScenarios,
  runBenchmarkScenario,
  runRecommendationBenchmarks,
} from "../src/services/recommendationBenchmarkService";

describe("recommendationBenchmarkService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
  });

  afterEach(() => jest.useRealTimers());

  test("scenario library is deterministic and covers more than one hundred benchmarks", () => {
    const first = recommendationBenchmarkScenarios();
    const second = recommendationBenchmarkScenarios();

    expect(first.length).toBeGreaterThanOrEqual(100);
    expect(first.map((scenario) => scenario.scenarioId)).toEqual(
      second.map((scenario) => scenario.scenarioId),
    );
    expect(new Set(first.map((scenario) => scenario.category)).size).toBeGreaterThan(10);
    expect(first.map((scenario) => scenario.category)).toEqual(
      expect.arrayContaining([
        "restaurants",
        "travel",
        "merchant_alias",
        "wallet_state_missing",
        "spend_cap_scenarios",
      ]),
    );
  });

  test("restaurant benchmark executes against the current recommendation engine", async () => {
    const scenario = recommendationBenchmarkScenarios().find(
      (item) => item.scenarioId === "restaurant-dining-gold",
    );
    if (!scenario) throw new Error("missing restaurant benchmark");

    const result = await runBenchmarkScenario(scenario);

    expect(result).toEqual(
      expect.objectContaining({
        scenarioId: "restaurant-dining-gold",
        expectedWinningCard: "amex-gold",
        actualWinningCard: "amex-gold",
        replayMatched: true,
        passed: true,
      }),
    );
    expect(result.explanation.evidence.scoring.length).toBeGreaterThan(0);
  });

  test("full benchmark report includes metrics, calibration, leaderboard, and deterministic replay", async () => {
    const scenarios = recommendationBenchmarkScenarios().slice(0, 20);
    const report = await runRecommendationBenchmarks(scenarios);

    expect(report).toEqual(
      expect.objectContaining({
        benchmarkVersion: BENCHMARK_VERSION,
        scenarioCount: 20,
        metrics: expect.objectContaining({
          recommendationAccuracy: expect.any(Number),
          replayConsistency: 1,
          explanationCompleteness: expect.any(Number),
          benchmarkPassRate: expect.any(Number),
        }),
        calibration: expect.objectContaining({
          distribution: expect.objectContaining({
            high: expect.any(Number),
            medium: expect.any(Number),
            low: expect.any(Number),
          }),
        }),
        leaderboard: expect.objectContaining({
          frequentlySelectedCards: expect.any(Array),
          commonFailures: expect.any(Array),
        }),
      }),
    );
    expect(report.results.every((result) => result.replayMatched)).toBe(true);
  });

  test("wallet, alias, travel, confidence, and spend-cap fixtures are reusable", async () => {
    const selected = recommendationBenchmarkScenarios().filter((scenario) =>
      [
        "wallet-state-missing-credit",
        "uber-eats-dining",
        "delta-flight-travel",
        "spend-cap-remaining",
        "unknown-merchant-flat",
      ].includes(scenario.scenarioId),
    );

    const report = await runRecommendationBenchmarks(selected);

    expect(report.results.map((result) => result.scenarioId)).toEqual(
      expect.arrayContaining([
        "wallet-state-missing-credit",
        "uber-eats-dining",
        "delta-flight-travel",
        "spend-cap-remaining",
        "unknown-merchant-flat",
      ]),
    );
    expect(report.metrics.walletResolutionAccuracy).toBeGreaterThan(0);
    expect(report.calibration.calibrationDrift).toBeGreaterThan(0);
  });

  test("accuracy metrics and confidence calibration are first-class deterministic values", async () => {
    const report = await runRecommendationBenchmarks(recommendationBenchmarkScenarios().slice(0, 10));
    const metrics = calculateAccuracyMetrics(report.results);
    const calibration = calculateConfidenceCalibration(report.results);

    expect(metrics.benchmarkPassRate).toBeGreaterThanOrEqual(0);
    expect(metrics.benchmarkPassRate).toBeLessThanOrEqual(1);
    expect(metrics.confidenceCalibration).toBe(calibration.calibrationDrift);
  });

  test("comparison and regression detection identify changed winners and replay failures", async () => {
    const scenarios = recommendationBenchmarkScenarios().slice(0, 5);
    const baseline = await runRecommendationBenchmarks(scenarios);
    const candidate = {
      ...baseline,
      results: baseline.results.map((result, index) =>
        index === 0
          ? {
              ...result,
              actualWinningCard: "flat-two",
              passed: false,
              replayMatched: false,
              failures: ["winning_card_mismatch", "replay_failed"],
            }
          : result,
      ),
    };

    const comparison = compareBenchmarkRuns(baseline, candidate);
    const regressions = detectBenchmarkRegressions(
      baseline.results[0],
      candidate.results[0],
    );

    expect(comparison).toEqual(
      expect.objectContaining({
        winnerChanged: 1,
        regressions: expect.arrayContaining([
          expect.objectContaining({ type: "recommendation_regression" }),
          expect.objectContaining({ type: "replay_failure" }),
        ]),
      }),
    );
    expect(regressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "replay_failure" }),
      ]),
    );
  });
});
