import { buildRecommendationValidationRun, writeRecommendationValidationReports } from "../src/validation/recommendationReport";
import { buildRecommendationCoverageSummary } from "../src/validation/recommendationCoverage";
import { assertRecommendationInvariants } from "../src/validation/recommendationInvariants";
import { runRecommendationMetamorphicChecks } from "../src/validation/recommendationMetamorphicTests";
import { runRecommendationMutationSmokeTests } from "../src/validation/recommendationMutationSmoke";
import { generateRecommendationScenarios } from "../src/validation/recommendationScenarioGenerator";
import { runRecommendationScenarios } from "../src/validation/recommendationScenarioRunner";
import { recommendationValidationCatalog } from "../tests/recommendation-validation/fixtures/cards/catalog";
import { curatedRecommendationScenarios } from "../tests/recommendation-validation/scenarios";

const catalog = recommendationValidationCatalog();
const curatedResults = runRecommendationScenarios(curatedRecommendationScenarios, catalog);
const generatedScenarios = generateRecommendationScenarios({
  seed: 20260724,
  count: 1000,
  catalog,
});
const generatedResults = runRecommendationScenarios(generatedScenarios, catalog);
const allScenarios = [...curatedRecommendationScenarios, ...generatedScenarios];
const allResults = [...curatedResults, ...generatedResults];
const invariantAssertions = assertRecommendationInvariants(allScenarios, catalog);
const metamorphicAssertions = runRecommendationMetamorphicChecks(allScenarios, catalog, {
  seed: 20260724,
  sampleSize: 100,
});
const run = buildRecommendationValidationRun({
  results: allResults,
  seed: 20260724,
  suite: "curated+generated",
  generatedScenarioCount: generatedScenarios.length,
  coverage: buildRecommendationCoverageSummary(allScenarios, allResults, {
    invariantAssertions,
    metamorphicAssertions,
  }),
  mutationSmoke: runRecommendationMutationSmokeTests(curatedRecommendationScenarios, catalog),
  invariants: {
    passed: invariantAssertions.filter((assertion) => assertion.passed).length,
    total: invariantAssertions.length,
  },
  metamorphic: {
    passed: metamorphicAssertions.filter((assertion) => assertion.passed).length,
    total: metamorphicAssertions.length,
  },
  registryVersion: "fixture-v1",
  commitSha: process.env.GITHUB_SHA || "local",
});
const paths = writeRecommendationValidationReports(run);

console.log(`Wrote ${paths.jsonPath}`);
console.log(`Wrote ${paths.markdownPath}`);
console.log(
  `Recommendation validation report: ${run.summary.passed}/${run.summary.total} passed`,
);
if (run.summary.failed) process.exit(1);
