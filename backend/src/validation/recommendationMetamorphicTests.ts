import type { RecommendationScenario, ScenarioCatalog, ScenarioAssertionResult } from "./recommendationScenario.types";
import { evaluateScenarioWithReference } from "./recommendationReferenceEvaluator";
import { runRecommendationScenario } from "./recommendationScenarioRunner";

export type RecommendationMetamorphicTransform = {
  id: string;
  applies: (scenario: RecommendationScenario) => boolean;
  build: (scenario: RecommendationScenario, catalog: ScenarioCatalog) => RecommendationScenario | null;
  assert: (
    baseline: ReturnType<typeof runRecommendationScenario>,
    transformed: ReturnType<typeof runRecommendationScenario>,
  ) => ScenarioAssertionResult;
};

export function runRecommendationMetamorphicChecks(
  scenarios: RecommendationScenario[],
  catalog: ScenarioCatalog,
  input: { seed?: number; sampleSize?: number } = {},
): ScenarioAssertionResult[] {
  const assertions: ScenarioAssertionResult[] = [];
  const selected = seededSample(
    scenarios.filter((scenario) => transforms.some((transform) => transform.applies(scenario))),
    input.seed ?? 20260724,
    input.sampleSize ?? scenarios.length,
  );
  selected.forEach((scenario) => {
    transforms
      .filter((transform) => transform.applies(scenario))
      .forEach((transform) => {
        const baseline = runRecommendationScenario(scenario, catalog);
        const transformedScenario = transform.build(scenario, catalog);
        if (!transformedScenario) return;
        const transformed = runRecommendationScenario(transformedScenario, catalog);
        assertions.push(transform.assert(baseline, transformed));
      });
  });
  return assertions;
}

export const transforms: RecommendationMetamorphicTransform[] = [
  {
    id: "remove-winning-card",
    applies: (scenario) => scenario.wallet.cards.length > 1,
    build: (scenario, catalog) => {
      const baseline = runRecommendationScenario(scenario, catalog);
      const winner = baseline.actual.winnerCardSlug;
      if (!winner) return null;
      const transformed = {
        ...clone(scenario),
        id: `${scenario.id}-remove-winning-card`,
        wallet: {
          ...scenario.wallet,
          cards: scenario.wallet.cards.filter((card) => card.cardSlug !== winner),
        },
      };
      const oracle = evaluateScenarioWithReference(transformed, catalog);
      return {
        ...transformed,
        expected: expectedFromOracle(transformed, catalog, oracle),
      };
    },
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: remove-winning-card transform`,
      passed:
        transformed.actual.winnerCardSlug !== baseline.actual.winnerCardSlug &&
        transformed.passed,
      expected: "previous winner removed and oracle next-best wins",
      actual: transformed.actual,
    }),
  },
  {
    id: "reorder-wallet-cards",
    applies: (scenario) => scenario.wallet.cards.length > 1,
    build: (scenario) => ({
      ...clone(scenario),
      id: `${scenario.id}-reorder-wallet-cards`,
      wallet: { ...scenario.wallet, cards: [...scenario.wallet.cards].reverse() },
    }),
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: reorder-wallet-cards transform`,
      passed:
        baseline.actual.winnerCardSlug === transformed.actual.winnerCardSlug &&
        baseline.actual.winnerBenefitId === transformed.actual.winnerBenefitId &&
        baseline.actual.cashEquivalent === transformed.actual.cashEquivalent,
      expected: baseline.actual,
      actual: transformed.actual,
    }),
  },
  {
    id: "add-irrelevant-low-value-card",
    applies: (scenario) => scenario.wallet.cards.length > 0,
    build: (scenario, catalog) => {
      const baselineOracle = evaluateScenarioWithReference(scenario, catalog);
      const owned = new Set(scenario.wallet.cards.map((card) => card.cardSlug));
      for (const cardSlug of Object.keys(catalog).sort()) {
        if (owned.has(cardSlug)) continue;
        const transformed = {
          ...clone(scenario),
          id: `${scenario.id}-add-irrelevant-low-value-card`,
          wallet: {
            ...scenario.wallet,
            cards: [...scenario.wallet.cards, { cardSlug }],
          },
        };
        const transformedOracle = evaluateScenarioWithReference(transformed, catalog);
        if (
          transformedOracle.winnerCardSlug === baselineOracle.winnerCardSlug &&
          transformedOracle.winnerBenefitId === baselineOracle.winnerBenefitId
        ) {
          return {
            ...transformed,
            expected: expectedFromOracle(transformed, catalog, transformedOracle),
          };
        }
      }
      return null;
    },
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: add-irrelevant-low-value-card transform`,
      passed:
        baseline.actual.winnerCardSlug === transformed.actual.winnerCardSlug &&
        baseline.actual.winnerBenefitId === transformed.actual.winnerBenefitId,
      expected: baseline.actual.winnerCardSlug,
      actual: transformed.actual.winnerCardSlug,
    }),
  },
  {
    id: "degrade-classification-confidence",
    applies: (scenario) => scenario.classification.source !== "unknown",
    build: (scenario) => ({
      ...clone(scenario),
      id: `${scenario.id}-degrade-classification-confidence`,
      classification: {
        ...scenario.classification,
        confidence: 0.45,
        source: "inferred",
        isVerified: false,
      },
    }),
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: degrade-classification-confidence transform`,
      passed: (transformed.actual.confidenceScore || 0) <= (baseline.actual.confidenceScore || 0),
      expected: `<= ${baseline.actual.confidenceScore}`,
      actual: transformed.actual.confidenceScore,
    }),
  },
  {
    id: "exhaust-winning-cap",
    applies: (scenario) => Boolean(scenario.walletBenefitStates?.length),
    build: (scenario, catalog) => {
      const baseline = runRecommendationScenario(scenario, catalog);
      const benefitId = baseline.actual.winnerBenefitId;
      const state = scenario.walletBenefitStates?.find((item) => item.benefitId === benefitId);
      if (!state || state.remainingSpendCap === null) return null;
      const transformed = {
        ...clone(scenario),
        id: `${scenario.id}-exhaust-winning-cap`,
        walletBenefitStates: scenario.walletBenefitStates?.map((item) =>
          item.benefitId === benefitId
            ? {
                ...item,
                status: "exhausted" as const,
                benefitState: "exhausted" as const,
                remainingSpendCap: 0,
              }
            : item,
        ),
      };
      const oracle = evaluateScenarioWithReference(transformed, catalog);
      return { ...transformed, expected: expectedFromOracle(transformed, catalog, oracle) };
    },
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: exhaust-winning-cap transform`,
      passed:
        transformed.passed &&
        transformed.actual.winnerBenefitId !== baseline.actual.winnerBenefitId,
      expected: "capped winning benefit stops winning after cap exhaustion",
      actual: transformed.actual,
    }),
  },
  {
    id: "remove-required-enrollment",
    applies: (scenario) => Boolean(scenario.walletBenefitStates?.length),
    build: (scenario, catalog) => {
      const baseline = runRecommendationScenario(scenario, catalog);
      const benefitId = baseline.actual.winnerBenefitId;
      const state = scenario.walletBenefitStates?.find((item) => item.benefitId === benefitId);
      if (!state || state.enrollmentStatus !== "enrolled") return null;
      const transformed = {
        ...clone(scenario),
        id: `${scenario.id}-remove-required-enrollment`,
        walletBenefitStates: scenario.walletBenefitStates?.map((item) =>
          item.benefitId === benefitId
            ? {
                ...item,
                status: "enrollment_required" as const,
                benefitState: "enrollment_required" as const,
                enrollmentStatus: "not_enrolled" as const,
              }
            : item,
        ),
      };
      const oracle = evaluateScenarioWithReference(transformed, catalog);
      return { ...transformed, expected: expectedFromOracle(transformed, catalog, oracle) };
    },
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: remove-required-enrollment transform`,
      passed:
        transformed.passed &&
        transformed.actual.winnerBenefitId !== baseline.actual.winnerBenefitId,
      expected: "enrollment-required benefit becomes ineligible",
      actual: transformed.actual,
    }),
  },
  {
    id: "remove-required-activation",
    applies: (scenario) => Boolean(scenario.walletBenefitStates?.length),
    build: (scenario, catalog) => {
      const baseline = runRecommendationScenario(scenario, catalog);
      const benefitId = baseline.actual.winnerBenefitId;
      const state = scenario.walletBenefitStates?.find((item) => item.benefitId === benefitId);
      if (!state || state.activationStatus !== "activated") return null;
      const transformed = {
        ...clone(scenario),
        id: `${scenario.id}-remove-required-activation`,
        walletBenefitStates: scenario.walletBenefitStates?.map((item) =>
          item.benefitId === benefitId
            ? {
                ...item,
                status: "activation_required" as const,
                benefitState: "activation_required" as const,
                activationStatus: "not_activated" as const,
              }
            : item,
        ),
      };
      const oracle = evaluateScenarioWithReference(transformed, catalog);
      return { ...transformed, expected: expectedFromOracle(transformed, catalog, oracle) };
    },
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: remove-required-activation transform`,
      passed:
        transformed.passed &&
        transformed.actual.winnerBenefitId !== baseline.actual.winnerBenefitId,
      expected: "activation-required benefit becomes ineligible",
      actual: transformed.actual,
    }),
  },
  {
    id: "change-channel-away-from-issuer-portal",
    applies: (scenario) => scenario.purchase.channel === "issuer_portal",
    build: (scenario, catalog) => {
      const transformed = {
        ...clone(scenario),
        id: `${scenario.id}-change-channel-away-from-issuer-portal`,
        purchase: { ...scenario.purchase, channel: "online" as const },
      };
      const oracle = evaluateScenarioWithReference(transformed, catalog);
      return {
        ...transformed,
        expected: expectedFromOracle(transformed, catalog, oracle),
      };
    },
    assert: (_baseline, transformed) => ({
      name: `${transformed.scenarioId}: change-channel-away-from-issuer-portal transform`,
      passed: transformed.passed,
      expected: "portal-only rule no longer required to win",
      actual: transformed.actual,
    }),
  },
  {
    id: "change-merchant-retain-category",
    applies: (scenario) =>
      scenario.expected.winnerRuleType === "merchant_specific" ||
      scenario.expected.winnerRuleType === "statement_credit",
    build: (scenario, catalog) => {
      const transformed = {
        ...clone(scenario),
        id: `${scenario.id}-change-merchant-retain-category`,
        purchase: {
          ...scenario.purchase,
          merchantName: "Different Retailer",
          normalizedMerchant: "different retailer",
          merchantId: "different-retailer",
        },
      };
      const oracle = evaluateScenarioWithReference(transformed, catalog);
      return { ...transformed, expected: expectedFromOracle(transformed, catalog, oracle) };
    },
    assert: (baseline, transformed) => ({
      name: `${baseline.scenarioId}: change-merchant-retain-category transform`,
      passed:
        transformed.passed &&
        transformed.actual.winnerBenefitId !== baseline.actual.winnerBenefitId,
      expected: "merchant-specific rule stops matching while category/base rules remain eligible",
      actual: transformed.actual,
    }),
  },
  {
    id: "move-after-expiration",
    applies: (scenario) => scenario.tags.includes("rotating"),
    build: (scenario, catalog) => {
      const transformed = {
        ...clone(scenario),
        id: `${scenario.id}-move-after-expiration`,
        purchase: { ...scenario.purchase, transactionDate: "2026-10-01T00:00:01.000Z" },
      };
      const oracle = evaluateScenarioWithReference(transformed, catalog);
      return {
        ...transformed,
        expected: expectedFromOracle(transformed, catalog, oracle),
      };
    },
    assert: (_baseline, transformed) => ({
      name: `${transformed.scenarioId}: move-after-expiration transform`,
      passed: transformed.passed,
      expected: "expired benefit cannot win",
      actual: transformed.actual,
    }),
  },
];

function seededSample<T>(items: T[], seed: number, sampleSize: number) {
  const random = seededRandom(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy.slice(0, Math.min(sampleSize, copy.length));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function clone(scenario: RecommendationScenario): RecommendationScenario {
  return JSON.parse(JSON.stringify(scenario)) as RecommendationScenario;
}

function expectedFromOracle(
  scenario: RecommendationScenario,
  catalog: ScenarioCatalog,
  oracle: ReturnType<typeof evaluateScenarioWithReference>,
) {
  return {
    ...scenario.expected,
    winnerCardSlug: oracle.winnerCardSlug,
    winnerBenefitId: oracle.winnerBenefitId,
    winnerRuleType: oracle.winnerRuleType,
    expectedReward: {
      cashEquivalent: oracle.expectedValueUSD,
      tolerance: 0.05,
    },
    explanationMustContain: [(catalog[oracle.winnerCardSlug] as any)?.name || oracle.winnerCardSlug],
    explanationMustNotContain: ["Verified wallet rewards", "Calculated after checkout total"],
  };
}
