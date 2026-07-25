import { buildRecommendationCoverageSummary } from "../../src/validation/recommendationCoverage";
import { recommendationCoverageRequirements } from "../../src/validation/recommendationCoverageRequirements";
import type {
  RecommendationScenario,
  ScenarioValidationResult,
} from "../../src/validation/recommendationScenario.types";
import { runRecommendationScenarios } from "../../src/validation/recommendationScenarioRunner";
import { recommendationValidationCatalog } from "./fixtures/cards/catalog";
import { curatedRecommendationScenarios } from "./scenarios";

describe("recommendation semantic coverage framework", () => {
  const catalog = recommendationValidationCatalog();

  test("threshold counts are deterministic and scenario IDs appear in diagnostics", () => {
    const scenarios = curatedRecommendationScenarios;
    const first = buildRecommendationCoverageSummary(
      scenarios,
      runRecommendationScenarios(scenarios, catalog),
    );
    const second = buildRecommendationCoverageSummary(
      scenarios,
      runRecommendationScenarios(scenarios, catalog),
    );

    expect(first.dimensions).toEqual(second.dimensions);
    expect(first.branchStatuses.some((status) => status.scenarioIds.length > 0)).toBe(true);
  });

  test("critical branches fail without curated coverage", () => {
    const generatedOnly = curatedRecommendationScenarios.slice(0, 1).map((scenario) => ({
      ...scenario,
      tags: scenario.tags.filter((tag) => tag !== "curated"),
    }));
    const coverage = buildRecommendationCoverageSummary(
      generatedOnly,
      runRecommendationScenarios(generatedOnly, catalog),
    );

    expect(coverage.uncoveredRequiredBranches.length).toBeGreaterThan(0);
    expect(
      coverage.uncoveredRequiredBranches.some((branch) => branch.curatedRequired),
    ).toBe(true);
  });

  test("zero scenarios cannot pass required semantic coverage", () => {
    const coverage = buildRecommendationCoverageSummary([], []);

    expect(coverage.uncoveredRequiredBranches.length).toBe(
      recommendationCoverageRequirements.length,
    );
  });

  test("merchant mismatch increments only merchant mismatch", () => {
    const { scenario, result } = restrictionFixture("merchant_credit");
    const coverage = buildRecommendationCoverageSummary([scenario], [result]);

    expect(coverage.dimensions.eligibility.merchant_mismatch).toBe(1);
    expect(coverage.dimensions.eligibility.category_mismatch || 0).toBe(0);
  });

  test("category mismatch increments only category mismatch", () => {
    const { scenario, result } = restrictionFixture("reward_category");
    const coverage = buildRecommendationCoverageSummary([scenario], [result]);

    expect(coverage.dimensions.eligibility.category_mismatch).toBe(1);
    expect(coverage.dimensions.eligibility.merchant_mismatch || 0).toBe(0);
  });

  test("generic incompatible restriction does not automatically count as both", () => {
    const { scenario, result } = restrictionFixture("unknown");
    const coverage = buildRecommendationCoverageSummary([scenario], [result]);

    expect(coverage.dimensions.eligibility?.merchant_mismatch || 0).toBe(0);
    expect(coverage.dimensions.eligibility?.category_mismatch || 0).toBe(0);
  });
});

function restrictionFixture(sourceKind: string): {
  scenario: RecommendationScenario;
  result: ScenarioValidationResult;
} {
  const scenario = curatedRecommendationScenarios[0];
  const result: ScenarioValidationResult = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    passed: true,
    durationMs: 1,
    expected: scenario.expected,
    actual: { winnerCardSlug: scenario.expected.winnerCardSlug },
    assertions: [],
    failureCategories: [],
    reproductionCommand: "npm run validate:recommendations",
    decisionTrace: {
      winningCard: null,
      runnerUp: null,
      winningRule: null,
      estimatedReward: null,
      evaluatedCards: [
        {
          card: { slug: "fixture", name: "Fixture", issuer: "Fixture", annualFee: 0 },
          winningRule: null,
          applicableRule: null,
          estimatedValueUSD: 0,
          confidence: 0,
          rejectedRules: [],
          trace: [
            {
              ruleId: "fixture-rule",
              benefitId: "fixture-benefit",
              label: "Fixture benefit",
              sourceKind: sourceKind as any,
              applicable: false,
              rejectionReasons: ["BENEFIT_RESTRICTION_INCOMPATIBLE"],
              earningRate: null,
              estimatedRewardQuantity: null,
              estimatedCashEquivalentValue: 0,
              confidence: 0,
              confidenceFactors: {
                merchantClassificationConfidence: 0,
                benefitConfidence: 0,
                walletStateConfidence: 0,
                dataFreshness: 0,
              },
              walletStateEffect: "none",
              valuation: {
                source: "cash",
                rewardCurrency: "cash",
                valuePerUnitUSD: 1,
                explanation: "fixture",
              },
            },
          ],
        },
      ],
      comparison: { mode: "direct_earning_rate", explanation: "fixture" },
      classification: {
        category: scenario.classification.category,
        confidence: scenario.classification.confidence,
        source: scenario.classification.source,
        evidence: [],
        verified: scenario.classification.isVerified,
      },
      explanation: "",
      confidence: { score: 0, label: "low" },
      auditLog: {} as any,
    },
  };
  return { scenario, result };
}
