import fs from "fs";
import path from "path";
import type {
  RecommendationValidationRun,
  ScenarioValidationResult,
} from "./recommendationScenario.types";

export function buildRecommendationValidationRun(input: {
  results: ScenarioValidationResult[];
  seed?: number;
  suite?: string;
  generatedScenarioCount?: number;
  coverage?: RecommendationValidationRun["coverage"];
  mutationSmoke?: RecommendationValidationRun["mutationSmoke"];
  invariants?: RecommendationValidationRun["invariants"];
  metamorphic?: RecommendationValidationRun["metamorphic"];
  generatedAt?: string;
  registryVersion?: string;
  commitSha?: string;
}): RecommendationValidationRun {
  const passed = input.results.filter((result) => result.passed).length;
  const failed = input.results.length - passed;
  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    registryVersion: input.registryVersion || "fixture-v1",
    commitSha: input.commitSha || "local",
    seed: input.seed,
    suite: input.suite,
    generatedScenarioCount: input.generatedScenarioCount,
    coverage: input.coverage,
    mutationSmoke: input.mutationSmoke,
    invariants: input.invariants,
    metamorphic: input.metamorphic,
    summary: {
      total: input.results.length,
      passed,
      failed,
      passRate: input.results.length ? passed / input.results.length : 0,
    },
    byCategory: groupByCategory(input.results),
    byFailureType: groupByFailure(input.results),
    failures: input.results.filter((result) => !result.passed),
    results: input.results,
  };
}

export function writeRecommendationValidationReports(
  run: RecommendationValidationRun,
  outputDir = path.resolve(__dirname, "../../..", "docs"),
) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "RECOMMENDATION_VALIDATION_REPORT.json");
  const markdownPath = path.join(outputDir, "RECOMMENDATION_VALIDATION_REPORT.md");
  fs.writeFileSync(jsonPath, JSON.stringify(run, null, 2));
  fs.writeFileSync(markdownPath, renderRecommendationValidationMarkdown(run));
  return { jsonPath, markdownPath };
}

export function renderRecommendationValidationMarkdown(run: RecommendationValidationRun) {
  const lines = [
    "# Recommendation Validation Report",
    "",
    `Generated: ${run.generatedAt}`,
    `Commit SHA: ${run.commitSha}`,
    `Benefit Registry version: ${run.registryVersion}`,
    run.suite ? `Suite: ${run.suite}` : undefined,
    run.seed !== undefined ? `Test seed: ${run.seed}` : "Test seed: curated",
    run.generatedScenarioCount !== undefined
      ? `Generated scenarios: ${run.generatedScenarioCount}`
      : undefined,
    "",
    "## Summary",
    "",
    `Total scenarios: ${run.summary.total}`,
    `Passed: ${run.summary.passed}`,
    `Failed: ${run.summary.failed}`,
    `Pass rate: ${(run.summary.passRate * 100).toFixed(2)}%`,
    "",
    "## Results By Purchase Category",
    "",
    ...Object.entries(run.byCategory).map(
      ([category, result]) =>
        `- ${category}: ${result.passed}/${result.total} passed (${result.failed} failed)`,
    ),
    "",
    "## Failure Categories",
    "",
    ...(Object.keys(run.byFailureType).length
      ? Object.entries(run.byFailureType).map(([category, count]) => `- ${category}: ${count}`)
      : ["No failures."]
    ),
    "",
    "## Coverage",
    "",
    ...(run.coverage
      ? [
          `Rule types: ${formatCounts(run.coverage.byRuleType)}`,
          `Purchase channels: ${formatCounts(run.coverage.byPurchaseChannel)}`,
          `Classification sources: ${formatCounts(run.coverage.byClassificationSource)}`,
          `Confidence bands: ${formatCounts(run.coverage.byConfidenceBand)}`,
          `Wallet sizes: ${formatCounts(run.coverage.byWalletSize)}`,
          `Currencies: ${formatCounts(run.coverage.byCurrency)}`,
          `Rejected-rule reasons: ${formatCounts(run.coverage.byRejectedReason)}`,
          run.coverage.thresholdFailures.length
            ? `Coverage threshold failures: ${run.coverage.thresholdFailures.join(", ")}`
            : "Coverage threshold failures: 0",
        ]
      : ["Coverage was not collected for this report."]),
    "",
    "## Mutation Smoke",
    "",
    ...(run.mutationSmoke?.length
      ? run.mutationSmoke.map((mutation) =>
          `- ${mutation.mutationId}: ${
            mutation.passedBaseline && mutation.mutationDetected ? "detected" : "not detected"
          }`,
        )
      : ["Mutation smoke was not collected for this report."]),
    "",
    "## Reproduction",
    "",
    "Run a specific curated scenario:",
    "",
    "```bash",
    "npm run validate:recommendations -- --scenario dining-001",
    "```",
    "",
    "Run a generated scenario by seed and index:",
    "",
    "```bash",
    "npm run validate:recommendations -- --suite generated --seed 20260724 --scenario-index 1842",
    "```",
    "",
    "## Known Unsupported Cases",
    "",
    "- Live issuer benefit freshness is not validated by this framework.",
    "- Cross-origin iframe checkout behavior is validated by extension tests, not wallet recommendation scenarios.",
    "- Missing flagship-card records are reported as registry data gaps rather than filled with guessed benefits.",
  ];
  if (run.failures.length) {
    lines.push("", "## Failures", "");
    run.failures.slice(0, 50).forEach((failure) => {
      lines.push(
        `### ${failure.scenarioId}`,
        "",
        `Expected winner: ${failure.expected.winnerCardSlug}`,
        `Actual winner: ${failure.actual.winnerCardSlug || "none"}`,
        `Failure categories: ${failure.failureCategories.join(", ")}`,
        `Reproduce: \`${failure.reproductionCommand}\``,
        "",
      );
    });
  }
  return `${lines.filter((line) => line !== undefined).join("\n")}\n`;
}

function groupByCategory(results: ScenarioValidationResult[]) {
  const grouped: Record<string, { total: number; passed: number; failed: number }> = {};
  results.forEach((result) => {
    const category = result.decisionTrace.classification.category || "unknown";
    grouped[category] ||= { total: 0, passed: 0, failed: 0 };
    grouped[category].total += 1;
    if (result.passed) grouped[category].passed += 1;
    else grouped[category].failed += 1;
  });
  return grouped;
}

function groupByFailure(results: ScenarioValidationResult[]) {
  const grouped: Record<string, number> = {};
  results.forEach((result) => {
    result.failureCategories.forEach((category) => {
      grouped[category] = (grouped[category] || 0) + 1;
    });
  });
  return grouped;
}

function formatCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  if (!entries.length) return "none";
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}
