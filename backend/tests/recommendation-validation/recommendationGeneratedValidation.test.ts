import { assertRecommendationInvariants } from "../../src/validation/recommendationInvariants";
import { buildRecommendationCoverageSummary } from "../../src/validation/recommendationCoverage";
import { runRecommendationMetamorphicChecks } from "../../src/validation/recommendationMetamorphicTests";
import { runRecommendationMutationSmokeTests } from "../../src/validation/recommendationMutationSmoke";
import { generateRecommendationScenarios } from "../../src/validation/recommendationScenarioGenerator";
import { runRecommendationScenarios } from "../../src/validation/recommendationScenarioRunner";
import { adaptCatalogToReference } from "../../src/validation/reference/referenceFixtureAdapter";
import { evaluateScenarioWithIndependentReference } from "../../src/validation/reference/referenceEvaluator";
import { recommendationValidationCatalog } from "./fixtures/cards/catalog";
import { curatedRecommendationScenarios } from "./scenarios";

describe("recommendation validation framework generated and invariant tests", () => {
  const catalog = recommendationValidationCatalog();

  test("seeded generated scenarios are deterministic and pass reference expectations", () => {
    const first = generateRecommendationScenarios({ seed: 20260724, count: 250, catalog });
    const second = generateRecommendationScenarios({ seed: 20260724, count: 250, catalog });

    expect(first.map((scenario) => scenario.id)).toEqual(second.map((scenario) => scenario.id));
    expect(first).toHaveLength(250);

    const results = runRecommendationScenarios(first, catalog);
    expect(
      results
        .filter((result) => !result.passed)
        .map((failure) => ({
          id: failure.scenarioId,
          expected: failure.expected.winnerCardSlug,
          actual: failure.actual.winnerCardSlug,
          categories: failure.failureCategories,
        })),
    ).toEqual([]);
    expect(results.every((result) => result.reproductionCommand.includes("--seed 20260724"))).toBe(true);
  });

  test("generated framework can build 10,000 reproducible cases", () => {
    const scenarios = generateRecommendationScenarios({ seed: 20260724, count: 10000, catalog });

    expect(scenarios).toHaveLength(10000);
    expect(scenarios[1842].metadata).toEqual(
      expect.objectContaining({
        generated: true,
        generatorSeed: 20260724,
        generatorIndex: 1842,
      }),
    );
  });

  test("invariants pass for curated scenarios", () => {
    const assertions = assertRecommendationInvariants(curatedRecommendationScenarios.slice(0, 20), catalog);

    expect(assertions.filter((assertion) => !assertion.passed)).toEqual([]);
    expect(assertions.map((assertion) => assertion.name)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/wallet-only invariant/),
        expect.stringMatching(/determinism invariant/),
        expect.stringMatching(/explanation invariant/),
        expect.stringMatching(/confidence invariant/),
      ]),
    );
  });

  test("metamorphic wallet-removal checks pass", () => {
    const assertions = runRecommendationMetamorphicChecks(curatedRecommendationScenarios, catalog);

    expect(assertions.length).toBeGreaterThan(0);
    expect(assertions.filter((assertion) => !assertion.passed)).toEqual([]);
    expect(assertions.map((assertion) => assertion.name)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/remove-winning-card transform/),
        expect.stringMatching(/reorder-wallet-cards transform/),
        expect.stringMatching(/add-irrelevant-low-value-card transform/),
        expect.stringMatching(/degrade-classification-confidence transform/),
        expect.stringMatching(/exhaust-winning-cap transform/),
        expect.stringMatching(/remove-required-enrollment transform/),
        expect.stringMatching(/remove-required-activation transform/),
        expect.stringMatching(/change-channel-away-from-issuer-portal transform/),
        expect.stringMatching(/move-after-expiration transform/),
        expect.stringMatching(/change-merchant-retain-category transform/),
      ]),
    );
  });

  test("reference evaluator is validation-owned and fixture adapter exposes explicit rules", () => {
    const source = require("fs").readFileSync(
      require("path").resolve(__dirname, "../../src/validation/recommendationReferenceEvaluator.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/canonicalizeCardBenefits|applyWalletUsageToBenefitValue|toCashEquivalent|walletDecisionEngine/);

    const referenceCatalog = adaptCatalogToReference(catalog);
    expect(referenceCatalog["capital-one-venture"].benefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capital-one-venture:flat:2x",
          ruleType: "base",
          rate: 2,
          rewardCurrency: "miles",
        }),
      ]),
    );
    expect(
      evaluateScenarioWithIndependentReference(curatedRecommendationScenarios[0], catalog).winnerCardSlug,
    ).toBe(curatedRecommendationScenarios[0].expected.winnerCardSlug);
  });

  test("coverage summary represents important generated dimensions", () => {
    const scenarios = generateRecommendationScenarios({ seed: 20260724, count: 1000, catalog });
    const allScenarios = [...curatedRecommendationScenarios, ...scenarios];
    const results = runRecommendationScenarios(allScenarios, catalog);
    const coverage = buildRecommendationCoverageSummary(allScenarios, results, {
      invariantAssertions: assertRecommendationInvariants(allScenarios, catalog),
      metamorphicAssertions: runRecommendationMetamorphicChecks(allScenarios, catalog, {
        seed: 20260724,
        sampleSize: 100,
      }),
    });

    expect(coverage.thresholdFailures).toEqual([]);
    expect(coverage.byRuleType.base).toBeGreaterThan(0);
    expect(coverage.byRuleType.category).toBeGreaterThan(0);
    expect(coverage.byPurchaseChannel.online).toBeGreaterThan(0);
    expect(coverage.byClassificationSource.verified).toBeGreaterThan(0);
    expect(coverage.byConfidenceBand.high).toBeGreaterThan(0);
    expect(coverage.byConfidenceBand.medium).toBeGreaterThan(0);
  });

  test("mutation smoke detects representative oracle and assertion failures", () => {
    const mutations = runRecommendationMutationSmokeTests(curatedRecommendationScenarios, catalog);

    expect(mutations).toHaveLength(10);
    expect(mutations.every((mutation) => mutation.passedBaseline)).toBe(true);
    expect(mutations.every((mutation) => mutation.mutationDetected)).toBe(true);
    expect(mutations.map((mutation) => mutation.mutationId)).toEqual(
      expect.arrayContaining([
        "allow-non-owned-global-card-to-win",
        "ignore-benefit-expiration",
        "ignore-activation-requirement",
        "ignore-enrollment-requirement",
        "ignore-cap-exhaustion",
        "use-wrong-point-valuation",
        "reverse-reward-value-sorting",
        "prefer-base-over-higher-category-rule",
        "wallet-array-order-final-tie-break",
        "runner-up-explanation-returned",
      ]),
    );
  });
});
