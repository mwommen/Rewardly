import {
  buildRecommendationLeaderboard,
  calculateConfidenceCalibration,
  compareBenchmarkRuns,
  recommendationBenchmarkScenarios,
  runRecommendationBenchmarks,
} from "./services/recommendationBenchmarkService";

const command = process.argv[2] || "benchmark";

async function run() {
  const scenarios = recommendationBenchmarkScenarios();
  const report = await runRecommendationBenchmarks(scenarios);

  if (command === "benchmark" || command === "full") {
    print(reportSummary(report));
    return;
  }
  if (command === "merchant") {
    print(report.results.filter((result) => ["merchant_alias", "parent_merchant", "billing_descriptor", "unknown_merchant"].includes(result.category)));
    return;
  }
  if (command === "wallet") {
    print(report.results.filter((result) => ["wallet_state_missing", "spend_cap_scenarios", "expired_benefits"].includes(result.category)));
    return;
  }
  if (command === "compare") {
    const candidate = await runRecommendationBenchmarks(scenarios.map((scenario, index) =>
      index === 0
        ? { ...scenario, expected: { ...scenario.expected, winningCard: "flat-two" } }
        : scenario,
    ));
    print(compareBenchmarkRuns(report, candidate));
    return;
  }
  if (command === "report") {
    print({
      metrics: report.metrics,
      leaderboard: report.leaderboard,
      failedScenarios: report.results.filter((result) => !result.passed).slice(0, 20),
    });
    return;
  }
  if (command === "confidence") {
    print(calculateConfidenceCalibration(report.results));
    return;
  }
  if (command === "leaderboard") {
    print(buildRecommendationLeaderboard(report.results));
    return;
  }
  print({
    usage:
      "ts-node src/recommendationBenchmarkCli.ts benchmark|full|merchant|wallet|compare|report|confidence|leaderboard",
  });
}

function reportSummary(report: Awaited<ReturnType<typeof runRecommendationBenchmarks>>) {
  return {
    benchmarkVersion: report.benchmarkVersion,
    scenarioCount: report.scenarioCount,
    passCount: report.passCount,
    failCount: report.failCount,
    metrics: report.metrics,
    calibration: report.calibration,
    leaderboard: report.leaderboard,
  };
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
