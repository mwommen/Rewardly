import fs from "fs";
import path from "path";

type SummaryInput = {
  validationPath?: string;
  coveragePath?: string;
  mutationPath?: string;
  outputPath?: string;
  artifactNames?: string[];
};

type DisplayValue = string | number;

export function buildRecommendationCiSummary(input: SummaryInput = {}) {
  const validation = readJson(input.validationPath || defaultDocPath("RECOMMENDATION_VALIDATION_REPORT.json"));
  const coverage = readJson(input.coveragePath || defaultDocPath("RECOMMENDATION_COVERAGE_REPORT.json"));
  const mutation = readJson(input.mutationPath || defaultDocPath("RECOMMENDATION_MUTATION_REPORT.json"));
  const artifacts = input.artifactNames || [
    "recommendation-validation-reports",
    "recommendation-validation-failures",
    "recommendation-ci-summary-source",
  ];
  const results = Array.isArray(validation?.results) ? validation.results : [];
  const curated = results.filter((result: any) => !result?.scenarioId?.startsWith("generated-"));
  const generated = results.filter((result: any) => result?.scenarioId?.startsWith("generated-"));
  const generatedCount =
    validation?.generatedScenarioCount ?? (generated.length ? generated.length : null);
  const invariant = countAssertionsByPrefix(results, "invariant:");
  const metamorphic = countAssertionsByPrefix(results, "metamorphic:");
  const mutations = Array.isArray(mutation) ? mutation : [];
  const killed = mutations.filter((item: any) => item?.mutationDetected === true || item?.killed === true).length;
  const executed = mutations.length;
  const thresholdFailures = Array.isArray(coverage?.thresholdFailures)
    ? coverage.thresholdFailures.length
    : Array.isArray(coverage?.uncoveredRequiredBranches)
      ? coverage.uncoveredRequiredBranches.length
      : null;

  return [
    "## Rewardly Recommendation Validation",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    row("Curated scenarios", scenarioSummary(curated)),
    row("Generated scenarios", scenarioSummary(generated)),
    row("Invariant checks", assertionSummary(validation?.invariants, invariant)),
    row("Metamorphic checks", assertionSummary(validation?.metamorphic, metamorphic)),
    row("Mutations killed/executed", executed ? `${killed}/${executed}` : "Unavailable"),
    row("Mutation score", executed ? `${((killed / executed) * 100).toFixed(2)}%` : "Unavailable"),
    row("Semantic coverage threshold failures", thresholdFailures ?? "Unavailable"),
    row("Seed", validation?.seed ?? "Unavailable"),
    row("Generated count", generatedCount ?? "Unavailable"),
    "",
    "### Artifacts",
    "",
    ...artifacts.map((artifact) => `- ${artifact}`),
    "",
  ].join("\n");
}

export function writeRecommendationCiSummary(input: SummaryInput = {}) {
  const markdown = buildRecommendationCiSummary(input);
  const outputPath = input.outputPath || process.env.GITHUB_STEP_SUMMARY;
  if (!outputPath) {
    process.stdout.write(markdown);
    return markdown;
  }
  fs.appendFileSync(outputPath, markdown);
  return markdown;
}

function readJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function defaultDocPath(fileName: string) {
  return path.resolve(__dirname, "../..", "docs", fileName);
}

function scenarioSummary(results: any[]) {
  if (!results.length) return "Unavailable";
  const passed = results.filter((result) => result?.passed === true).length;
  return `${passed}/${results.length} (${((passed / results.length) * 100).toFixed(2)}%)`;
}

function assertionSummary(
  explicit: { passed?: number; total?: number } | undefined,
  fallback: { passed: number; total: number },
) {
  const passed = explicit?.passed ?? fallback.passed;
  const total = explicit?.total ?? fallback.total;
  if (!total) return "Unavailable";
  return `${passed}/${total}`;
}

function countAssertionsByPrefix(results: any[], prefix: string) {
  const assertions = results.flatMap((result) =>
    Array.isArray(result?.assertions) ? result.assertions : [],
  );
  const matching = assertions.filter((assertion) =>
    String(assertion?.name || "").startsWith(prefix),
  );
  return {
    passed: matching.filter((assertion) => assertion?.passed === true).length,
    total: matching.length,
  };
}

function row(label: string, value: DisplayValue) {
  return `| ${label} | ${String(value)} |`;
}

if (require.main === module) {
  writeRecommendationCiSummary();
}
