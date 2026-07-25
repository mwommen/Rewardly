import fs from "fs";
import path from "path";
import { validateBenefitRegistryData } from "../src/validation/benefitRegistryDataQuality";
import type { RecommendationCoverageSummary } from "../src/validation/recommendationCoverage";
import { buildRecommendationCoverageSummary } from "../src/validation/recommendationCoverage";
import { assertRecommendationInvariants } from "../src/validation/recommendationInvariants";
import { runRecommendationMetamorphicChecks } from "../src/validation/recommendationMetamorphicTests";
import { runRecommendationMutationSmokeTests } from "../src/validation/recommendationMutationSmoke";
import { buildRecommendationValidationRun, writeRecommendationValidationReports } from "../src/validation/recommendationReport";
import { generateRecommendationScenarios } from "../src/validation/recommendationScenarioGenerator";
import { runRecommendationScenario, runRecommendationScenarios } from "../src/validation/recommendationScenarioRunner";
import { recommendationValidationCardList, recommendationValidationCatalog } from "../tests/recommendation-validation/fixtures/cards/catalog";
import { curatedRecommendationScenarios } from "../tests/recommendation-validation/scenarios";

type Suite = "curated" | "generated" | "full";

type Options = {
  suite: Suite;
  scenario?: string;
  tag?: string;
  seed: number;
  count: number;
  scenarioIndex?: number;
  report: boolean;
  failFast: boolean;
  verbose: boolean;
  invariants: boolean;
  metamorphic: boolean;
  coverage: boolean;
  mutationSmoke: boolean;
  showCoverageScenarios: boolean;
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const catalog = recommendationValidationCatalog();
  const generated =
    options.suite === "generated" || options.suite === "full"
      ? generateRecommendationScenarios({ seed: options.seed, count: options.count, catalog })
      : [];
  let scenarios =
    options.suite === "full"
      ? [...curatedRecommendationScenarios, ...generated]
      : options.suite === "generated"
        ? generated
        : curatedRecommendationScenarios;

  const beforeFilters = scenarios.length;
  if (options.scenario) scenarios = scenarios.filter((scenario) => scenario.id === options.scenario);
  if (options.tag) scenarios = scenarios.filter((scenario) => scenario.tags.includes(options.tag!));
  if (options.scenarioIndex !== undefined) {
    scenarios = scenarios.filter((scenario) => scenario.metadata?.generatorIndex === options.scenarioIndex);
  }
  if (!scenarios.length) {
    throw new Error(
      `No recommendation scenarios matched filters. suite=${options.suite} scenario=${options.scenario || "none"} tag=${options.tag || "none"} scenarioIndex=${options.scenarioIndex ?? "none"} beforeFilters=${beforeFilters}`,
    );
  }

  console.log(
    `Rewardly recommendation validation suite=${options.suite} seed=${options.seed} count=${options.count} scenarios=${scenarios.length} scenario=${options.scenario || "all"} tag=${options.tag || "all"} scenarioIndex=${options.scenarioIndex ?? "all"}`,
  );

  const results = options.failFast ? runFailFast(scenarios, catalog) : runRecommendationScenarios(scenarios, catalog);
  let run = buildRecommendationValidationRun({
    results,
    seed: options.suite === "generated" || options.suite === "full" ? options.seed : undefined,
    suite: options.suite,
    generatedScenarioCount:
      options.suite === "generated" || options.suite === "full"
        ? options.count
        : undefined,
    registryVersion: "fixture-v1",
    commitSha: process.env.GITHUB_SHA || "local",
  });
  const failed = results.filter((result) => !result.passed);
  printFailures(failed, options.verbose);

  let extraFailures = 0;
  let invariantAssertions: ReturnType<typeof assertRecommendationInvariants> = [];
  let metamorphicAssertions: ReturnType<typeof runRecommendationMetamorphicChecks> = [];
  let coverage: RecommendationCoverageSummary | null = null;
  let mutationResults: ReturnType<typeof runRecommendationMutationSmokeTests> = [];
  if (options.invariants || options.suite === "full") {
    invariantAssertions = assertRecommendationInvariants(scenarios, catalog);
    const failedInvariants = invariantAssertions.filter((assertion) => !assertion.passed);
    extraFailures += failedInvariants.length;
    console.log(`Invariants: ${invariantAssertions.length - failedInvariants.length}/${invariantAssertions.length} passed`);
    if (failedInvariants.length) console.error(JSON.stringify(failedInvariants, null, 2));
  }
  if (options.metamorphic || options.coverage || options.suite === "full") {
    metamorphicAssertions = runRecommendationMetamorphicChecks(scenarios, catalog, {
      seed: options.seed,
      sampleSize: options.suite === "full" ? 100 : scenarios.length,
    });
    const failedMetamorphic = metamorphicAssertions.filter((assertion) => !assertion.passed);
    extraFailures += failedMetamorphic.length;
    console.log(`Metamorphic: ${metamorphicAssertions.length - failedMetamorphic.length}/${metamorphicAssertions.length} passed seed=${options.seed}`);
    if (failedMetamorphic.length) console.error(JSON.stringify(failedMetamorphic, null, 2));
  }
  if (options.mutationSmoke || options.suite === "full") {
    mutationResults = runRecommendationMutationSmokeTests(scenarios, catalog);
    const failedMutations = mutationResults.filter(
      (result) => !result.passedBaseline || !result.mutationDetected,
    );
    extraFailures += failedMutations.length;
    console.log(`Mutation smoke: ${mutationResults.length - failedMutations.length}/${mutationResults.length} detected`);
    writeMutationReport(mutationResults);
    if (failedMutations.length) console.error(JSON.stringify(failedMutations, null, 2));
  }
  if (options.coverage || options.suite === "full") {
    if (!invariantAssertions.length) {
      invariantAssertions = assertRecommendationInvariants(scenarios, catalog);
    }
    coverage = buildRecommendationCoverageSummary(scenarios, results, {
      invariantAssertions,
      metamorphicAssertions,
    });
    extraFailures += coverage.uncoveredRequiredBranches.length;
    console.log(`Coverage threshold failures: ${coverage.uncoveredRequiredBranches.length}`);
    printCoverageSummary(coverage, options.showCoverageScenarios);
    writeCoverageReport(coverage);
  }
  if (options.suite === "full") {
    const quality = validateBenefitRegistryData(recommendationValidationCardList() as any);
    const errors = quality.issues.filter((issue) => issue.severity === "error");
    extraFailures += errors.length;
    console.log(`Registry quality: ${errors.length} errors, ${quality.issues.length} total issues`);
  }

  run = buildRecommendationValidationRun({
    results,
    seed: options.suite === "generated" || options.suite === "full" ? options.seed : undefined,
    suite: options.suite,
    generatedScenarioCount:
      options.suite === "generated" || options.suite === "full"
        ? options.count
        : undefined,
    registryVersion: "fixture-v1",
    commitSha: process.env.GITHUB_SHA || "local",
    coverage: coverage
      ? {
          byRuleType: coverage.byRuleType,
          byPurchaseChannel: coverage.byPurchaseChannel,
          byClassificationSource: coverage.byClassificationSource,
          byConfidenceBand: coverage.byConfidenceBand,
          byWalletSize: coverage.byWalletSize,
          byCurrency: coverage.byCurrency,
          byRejectedReason: coverage.byRejectedReason,
          thresholdFailures: coverage.thresholdFailures,
        }
      : undefined,
    mutationSmoke: mutationResults,
    invariants: summarizeAssertions(invariantAssertions),
    metamorphic: summarizeAssertions(metamorphicAssertions),
  });
  writeFailureArtifacts(failed, options, scenarios);

  console.log(
    `Recommendation validation: ${run.summary.passed}/${run.summary.total} passed (${(
      run.summary.passRate * 100
    ).toFixed(2)}%)`,
  );
  if (options.report) {
    const paths = writeRecommendationValidationReports(run);
    console.log(`Wrote ${paths.jsonPath}`);
    console.log(`Wrote ${paths.markdownPath}`);
  }
  if (failed.length || extraFailures) process.exit(1);
}

function runFailFast(scenarios: typeof curatedRecommendationScenarios, catalog: ReturnType<typeof recommendationValidationCatalog>) {
  const results = [];
  for (const scenario of scenarios) {
    const result = runRecommendationScenario(scenario, catalog);
    results.push(result);
    if (!result.passed) break;
  }
  return results;
}

function printFailures(failed: ReturnType<typeof runRecommendationScenarios>, verbose: boolean) {
  if (!verbose && !failed.length) return;
  failed.forEach((failure) => {
    console.error(`FAIL: ${failure.scenarioId}`);
    console.error(`Expected winner: ${failure.expected.winnerCardSlug}`);
    console.error(`Actual winner: ${failure.actual.winnerCardSlug || "none"}`);
    console.error(`Failure categories: ${failure.failureCategories.join(", ")}`);
    console.error(`Reproduce: ${failure.reproductionCommand}`);
    console.error(JSON.stringify(failure.assertions.filter((assertion) => !assertion.passed), null, 2));
  });
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    suite: "curated",
    seed: 20260724,
    count: 1000,
    report: false,
    failFast: false,
    verbose: false,
    invariants: false,
    metamorphic: false,
    coverage: false,
    mutationSmoke: false,
    showCoverageScenarios: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--suite" && next) {
      if (!["curated", "generated", "full"].includes(next)) throw new Error(`Invalid suite: ${next}`);
      options.suite = next as Suite;
      index += 1;
    } else if (arg === "--scenario" && next) {
      options.scenario = next;
      index += 1;
    } else if (arg === "--tag" && next) {
      options.tag = next;
      index += 1;
    } else if (arg === "--seed" && next) {
      options.seed = parsePositiveInteger(next, "seed");
      index += 1;
    } else if (arg === "--count" && next) {
      options.count = parsePositiveInteger(next, "count");
      index += 1;
    } else if (arg === "--scenario-index" && next) {
      options.scenarioIndex = parseNonNegativeInteger(next, "scenario-index");
      index += 1;
    } else if (arg === "--report") {
      options.report = true;
    } else if (arg === "--fail-fast") {
      options.failFast = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--invariants") {
      options.invariants = true;
    } else if (arg === "--metamorphic") {
      options.metamorphic = true;
    } else if (arg === "--coverage") {
      options.coverage = true;
    } else if (arg === "--mutation-smoke") {
      options.mutationSmoke = true;
    } else if (arg === "--show-coverage-scenarios") {
      options.showCoverageScenarios = true;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }
  return options;
}

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid ${name}: ${value}`);
  return parsed;
}

function parseNonNegativeInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Invalid ${name}: ${value}`);
  return parsed;
}

function summarizeAssertions(assertions: Array<{ passed: boolean }>) {
  return {
    passed: assertions.filter((assertion) => assertion.passed).length,
    total: assertions.length,
  };
}

function writeFailureArtifacts(
  failed: ReturnType<typeof runRecommendationScenarios>,
  options: Options,
  scenarios: typeof curatedRecommendationScenarios,
) {
  const outputDir = path.resolve(__dirname, "../validation-output/failures");
  fs.mkdirSync(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, "manifest.json");
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const artifacts = failed.map((failure) => {
    const scenario = scenarioById.get(failure.scenarioId);
    const artifact = {
      scenarioId: failure.scenarioId,
      seed: options.seed,
      generatorIndex: scenario?.metadata?.generatorIndex ?? null,
      input: scenario || null,
      expected: failure.expected,
      actual: failure.actual,
      failedAssertions: failure.assertions.filter((assertion) => !assertion.passed),
      failureCategories: failure.failureCategories,
      reproductionCommand: failure.reproductionCommand,
    };
    const fileName = `${sanitizeFileName(failure.scenarioId)}.json`;
    fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(artifact, null, 2));
    return { scenarioId: failure.scenarioId, fileName };
  });
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        suite: options.suite,
        seed: options.seed,
        count: options.count,
        failureCount: artifacts.length,
        artifacts,
      },
      null,
      2,
    ),
  );
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "_");
}

function printCoverageSummary(
  coverage: RecommendationCoverageSummary,
  showScenarios: boolean,
) {
  const failed = coverage.uncoveredRequiredBranches;
  console.log(
    JSON.stringify(
      {
        dimensions: coverage.dimensions,
        thresholdFailures: coverage.thresholdFailures,
      },
      null,
      2,
    ),
  );
  if (!failed.length && !showScenarios) return;
  const rows = showScenarios ? coverage.branchStatuses : failed;
  rows.forEach((branch) => {
    console.log(
      `${branch.dimension}/${branch.branch}: ${branch.count}/${branch.minimumCount} ${branch.passed ? "PASS" : "FAIL"} curated=${branch.curatedScenarioIds.length}`,
    );
    if (showScenarios) {
      console.log(`  scenarios: ${branch.scenarioIds.slice(0, 12).join(", ") || "none"}`);
    }
  });
}

function writeCoverageReport(coverage: RecommendationCoverageSummary) {
  const outputDir = path.resolve(__dirname, "../..", "docs");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "RECOMMENDATION_COVERAGE_REPORT.json"),
    JSON.stringify(coverage, null, 2),
  );
  const lines = [
    "# Recommendation Semantic Coverage Report",
    "",
    `Coverage threshold failures: ${coverage.uncoveredRequiredBranches.length}`,
    "",
    "| Dimension | Branch | Count | Minimum | Curated | Status |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...coverage.branchStatuses.map(
      (branch) =>
        `| ${branch.dimension} | ${branch.branch} | ${branch.count} | ${branch.minimumCount} | ${branch.curatedScenarioIds.length} | ${branch.passed ? "PASS" : "FAIL"} |`,
    ),
    "",
  ];
  fs.writeFileSync(path.join(outputDir, "RECOMMENDATION_COVERAGE_REPORT.md"), lines.join("\n"));
}

function writeMutationReport(mutations: ReturnType<typeof runRecommendationMutationSmokeTests>) {
  const outputDir = path.resolve(__dirname, "../..", "docs");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "RECOMMENDATION_MUTATION_REPORT.json"),
    JSON.stringify(mutations, null, 2),
  );
  const killed = mutations.filter((mutation) => mutation.mutationDetected).length;
  const lines = [
    "# Recommendation Mutation Report",
    "",
    `Mutation score: ${killed}/${mutations.length}`,
    "",
    "| Mutation | Killed | Scenarios | Killed By |",
    "| --- | --- | ---: | --- |",
    ...mutations.map(
      (mutation) =>
        `| ${mutation.mutationId} | ${mutation.mutationDetected ? "PASS" : "FAIL"} | ${mutation.scenariosRun || 0} | ${(mutation.killedBy || []).slice(0, 3).join("<br>")} |`,
    ),
    "",
  ];
  fs.writeFileSync(path.join(outputDir, "RECOMMENDATION_MUTATION_REPORT.md"), lines.join("\n"));
}
