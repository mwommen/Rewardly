import { validateBenefitRegistryData } from "../../src/validation/benefitRegistryDataQuality";
import { buildRecommendationValidationRun } from "../../src/validation/recommendationReport";
import { runRecommendationScenario, runRecommendationScenarios } from "../../src/validation/recommendationScenarioRunner";
import { recommendationValidationCardList, recommendationValidationCatalog } from "./fixtures/cards/catalog";
import { curatedRecommendationScenarios } from "./scenarios";

describe("recommendation validation framework curated scenarios", () => {
  const catalog = recommendationValidationCatalog();
  const results = runRecommendationScenarios(curatedRecommendationScenarios, catalog);

  test("contains at least 100 curated scenarios across major rule types", () => {
    expect(curatedRecommendationScenarios.length).toBeGreaterThanOrEqual(100);
    expect(new Set(curatedRecommendationScenarios.map((scenario) => scenario.id)).size).toBe(
      curatedRecommendationScenarios.length,
    );
    const ruleTypes = curatedRecommendationScenarios.map((scenario) => scenario.expected.winnerRuleType);
    expect(ruleTypes).toEqual(expect.arrayContaining(["base", "category", "portal", "statement_credit"]));
  });

  test("every curated scenario passes expected-versus-actual assertions", () => {
    const failed = results.filter((result) => !result.passed);
    expect(
      failed.map((failure) => ({
        id: failure.scenarioId,
        expected: failure.expected.winnerCardSlug,
        actual: failure.actual.winnerCardSlug,
        categories: failure.failureCategories,
        failedAssertions: failure.assertions
          .filter((assertion) => !assertion.passed)
          .map((assertion) => assertion.name),
      })),
    ).toEqual([]);
  });

  test("wallet-only behavior is enforced as a hard invariant", () => {
    results.forEach((result) => {
      const scenario = curatedRecommendationScenarios.find((item) => item.id === result.scenarioId)!;
      const walletSlugs = new Set(scenario.wallet.cards.map((card) => card.cardSlug));
      expect(result.decisionTrace.evaluatedCards.every((card) => walletSlugs.has(card.card.slug))).toBe(true);
      expect(walletSlugs.has(result.actual.winnerCardSlug!)).toBe(true);
    });
  });

  test("every failure result would include visible categories, assertions, trace, and reproduction command", () => {
    const invalid = {
      ...curatedRecommendationScenarios[0],
      id: "invalid-wallet-winner",
      expected: {
        ...curatedRecommendationScenarios[0].expected,
        winnerCardSlug: "not-owned",
      },
    };
    const invalidResult = runRecommendationScenario(invalid, catalog);

    expect(invalidResult.passed).toBe(false);
    expect(invalidResult.failureCategories).toContain("scenario_definition");
    expect(invalidResult.assertions[0].message).toMatch(/not present/i);
    expect(invalidResult.reproductionCommand).toContain("invalid-wallet-winner");
  });

  test("validation reports summarize pass/fail totals", () => {
    const run = buildRecommendationValidationRun({
      results,
      seed: 20260724,
      generatedAt: "2026-07-24T20:00:00.000Z",
      registryVersion: "fixture-v1",
      commitSha: "test",
    });

    expect(run.summary).toEqual({
      total: curatedRecommendationScenarios.length,
      passed: curatedRecommendationScenarios.length,
      failed: 0,
      passRate: 1,
    });
    expect(run.byCategory.dining.total).toBeGreaterThan(0);
    expect(run.failures).toEqual([]);
  });

  test("benefit registry data-quality validation reports no fixture errors", () => {
    const quality = validateBenefitRegistryData(recommendationValidationCardList() as any);

    expect(quality.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(quality.registry.rules.length).toBeGreaterThan(0);
  });
});
