import type { Card } from "../../../packages/rewardly-core/src";
import {
  defaultDecisionPolicies,
  type DecisionPolicies,
  type WalletDecisionCardScore,
  type WalletDecisionWinningRule,
} from "../services/walletDecisionEngine";
import type { CanonicalWalletBenefitState } from "../services/walletIntelligenceService";
import { assertRecommendationInvariants } from "./recommendationInvariants";
import type {
  RecommendationFailureCategory,
  RecommendationScenario,
  ScenarioCatalog,
  ScenarioValidationResult,
} from "./recommendationScenario.types";
import { runRecommendationScenario } from "./recommendationScenarioRunner";

export type RecommendationMutationSmokeResult = {
  mutationId: string;
  passedBaseline: boolean;
  mutationDetected: boolean;
  failureCategories: RecommendationFailureCategory[];
  killedBy?: string[];
  scenariosRun?: number;
  selectedScenarioIds?: string[];
  unexpectedErrors?: string[];
  durationMs?: number;
};

export type MutationResult = {
  mutationId: string;
  description: string;
  scenariosRun: number;
  selectedScenarioIds: string[];
  killed: boolean;
  killedBy: string[];
  survivingScenarioIds: string[];
  unexpectedErrors: string[];
  durationMs: number;
};

type MutationDefinition = {
  id: string;
  description: string;
  scenarioFilter: (scenario: RecommendationScenario) => boolean;
  policies: (catalog: ScenarioCatalog, scenarios: RecommendationScenario[]) => DecisionPolicies;
};

export function runRecommendationMutationSmokeTests(
  scenarios: RecommendationScenario[],
  catalog: ScenarioCatalog,
): RecommendationMutationSmokeResult[] {
  return runRecommendationBehaviorMutationTests(scenarios, catalog).map((result) => ({
    mutationId: result.mutationId,
    passedBaseline: result.unexpectedErrors.every((error) => !error.startsWith("baseline")),
    mutationDetected: result.killed,
    failureCategories: killedByToFailureCategories(result.killedBy),
    killedBy: result.killedBy,
    scenariosRun: result.scenariosRun,
    selectedScenarioIds: result.selectedScenarioIds,
    unexpectedErrors: result.unexpectedErrors,
    durationMs: result.durationMs,
  }));
}

export function runRecommendationBehaviorMutationTests(
  scenarios: RecommendationScenario[],
  catalog: ScenarioCatalog,
): MutationResult[] {
  return mutationDefinitions.map((definition) =>
    runMutationDefinition(definition, scenarios, catalog),
  );
}

export const mutationDefinitions: MutationDefinition[] = [
  {
    id: "allow-non-owned-global-card-to-win",
    description: "Engine evaluates a high-value card outside the user's wallet.",
    scenarioFilter: (scenario) =>
      ["general-retail-001", "dining-001"].includes(scenario.id),
    policies: () => ({
      ...defaultDecisionPolicies,
      selectCandidateCards: (walletCards) => [...walletCards, unownedHighValueCard()],
    }),
  },
  {
    id: "ignore-benefit-expiration",
    description: "Expired benefits remain eligible for scoring.",
    scenarioFilter: (scenario) =>
      ["rotating-after-quarter-001", "rotating-quarter-end-001"].includes(
        scenario.id,
      ),
    policies: () => ({
      ...defaultDecisionPolicies,
      evaluateEligibility: (benefit, context) => {
        const result = defaultDecisionPolicies.evaluateEligibility(benefit, context);
        if (!result.eligible && result.reasonCode === "BENEFIT_EXPIRED") {
          return { eligible: true, reasonCode: null, explanation: "MUTATION: ignored expiration" };
        }
        return result;
      },
    }),
  },
  {
    id: "ignore-activation-requirement",
    description: "Activation-required benefits remain eligible when inactive or unknown.",
    scenarioFilter: (scenario) =>
      ["gas-not-activated-001", "rotating-not-activated-001"].includes(
        scenario.id,
      ),
    policies: () => ({
      ...defaultDecisionPolicies,
      adjustWalletUsage: (benefit, states) => {
        const adjusted = defaultDecisionPolicies.adjustWalletUsage(benefit, states);
        if (adjusted.walletDecision.reason === "activation_required") {
          return markWalletDecisionEligible(adjusted, "MUTATION: ignored activation");
        }
        return adjusted;
      },
      evaluateEligibility: (benefit, context) => {
        const result = defaultDecisionPolicies.evaluateEligibility(benefit, context);
        if (
          !result.eligible &&
          (result.reasonCode === "BENEFIT_ACTIVATION_REQUIRED" ||
            result.reasonCode === "BENEFIT_USER_STATUS_UNKNOWN")
        ) {
          return { eligible: true, reasonCode: null, explanation: "MUTATION: ignored activation" };
        }
        return result;
      },
    }),
  },
  {
    id: "ignore-enrollment-requirement",
    description: "Enrollment-required benefits remain eligible when unenrolled or unknown.",
    scenarioFilter: (scenario) =>
      ["statement-credit-not-enrolled-001"].includes(scenario.id),
    policies: () => ({
      ...defaultDecisionPolicies,
      adjustWalletUsage: (benefit, states) => {
        const adjusted = defaultDecisionPolicies.adjustWalletUsage(benefit, states);
        if (adjusted.walletDecision.reason === "enrollment_required") {
          return markWalletDecisionEligible(adjusted, "MUTATION: ignored enrollment");
        }
        return adjusted;
      },
      evaluateEligibility: (benefit, context) => {
        const result = defaultDecisionPolicies.evaluateEligibility(benefit, context);
        if (
          !result.eligible &&
          (result.reasonCode === "BENEFIT_ENROLLMENT_REQUIRED" ||
            result.reasonCode === "BENEFIT_USER_STATUS_UNKNOWN")
        ) {
          return { eligible: true, reasonCode: null, explanation: "MUTATION: ignored enrollment" };
        }
        return result;
      },
    }),
  },
  {
    id: "ignore-cap-exhaustion",
    description: "Capped benefits are valued as though remaining cap is unlimited.",
    scenarioFilter: (scenario) =>
      ["gas-cap-exhausted-001", "grocery-partial-cap-001"].includes(
        scenario.id,
      ),
    policies: () => ({
      ...defaultDecisionPolicies,
      adjustWalletUsage: (benefit, states) => {
        const adjusted = defaultDecisionPolicies.adjustWalletUsage(benefit, states);
        const state = adjusted.walletDecision.state;
        if (!state || state.remainingSpendCap === null) return adjusted;
        return markWalletDecisionEligible(
          {
            ...adjusted,
            walletDecision: {
              ...adjusted.walletDecision,
              state: {
                ...state,
                remainingSpendCap: 999_999,
              } as CanonicalWalletBenefitState,
              remainingValue: 999_999,
            },
          },
          "MUTATION: ignored cap exhaustion",
        );
      },
    }),
  },
  {
    id: "use-wrong-point-valuation",
    description: "American Express point value is doubled during valuation.",
    scenarioFilter: (scenario) =>
      ["dining-001", "ambiguous-dining-merchant-001"].includes(scenario.id),
    policies: () => ({
      ...defaultDecisionPolicies,
      estimateBenefitValue: (benefit, card, purchase, walletState) => {
        const estimated = defaultDecisionPolicies.estimateBenefitValue(
          benefit,
          card,
          purchase,
          walletState,
        );
        if (benefit.rewardMechanism === "points" && /amex|american express/i.test(`${card.issuer} ${card.name}`)) {
          return {
            ...estimated,
            valueUSD: estimated.valueUSD * 2,
          };
        }
        return estimated;
      },
    }),
  },
  {
    id: "reverse-reward-value-sorting",
    description: "Lowest cash-equivalent candidate is ranked first.",
    scenarioFilter: (scenario) =>
      ["dining-001", "general-retail-001"].includes(scenario.id),
    policies: () => ({
      ...defaultDecisionPolicies,
      compareCardScores: (a, b) => {
        if (a.estimatedValueUSD !== b.estimatedValueUSD) {
          return a.estimatedValueUSD - b.estimatedValueUSD;
        }
        return defaultDecisionPolicies.compareCardScores(a, b);
      },
    }),
  },
  {
    id: "prefer-base-over-higher-category-rule",
    description: "Base earning receives precedence over valid category bonuses.",
    scenarioFilter: (scenario) =>
      ["dining-001", "portal-001", "statement-credit-full-001"].includes(
        scenario.id,
      ),
    policies: () => ({
      ...defaultDecisionPolicies,
      compareRules: (a, b) => {
        const aBase = a.sourceKind === "reward_flat";
        const bBase = b.sourceKind === "reward_flat";
        if (aBase !== bBase) return aBase ? -1 : 1;
        return defaultDecisionPolicies.compareRules(a, b);
      },
    }),
  },
  {
    id: "wallet-array-order-final-tie-break",
    description: "Exact ties are resolved by wallet input order instead of deterministic policy.",
    scenarioFilter: (scenario) =>
      ["tie-base-001", "tie-category-001"].includes(scenario.id),
    policies: () => ({
      ...defaultDecisionPolicies,
      compareCardScores: (a, b) => {
        if (b.estimatedValueUSD !== a.estimatedValueUSD) {
          return b.estimatedValueUSD - a.estimatedValueUSD;
        }
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return b.card.slug.localeCompare(a.card.slug);
      },
    }),
  },
  {
    id: "runner-up-explanation-returned",
    description: "Explanation is generated from the runner-up instead of the winner.",
    scenarioFilter: (scenario) =>
      ["dining-001", "statement-credit-full-001"].includes(scenario.id),
    policies: () => ({
      ...defaultDecisionPolicies,
      buildExplanation: ({ winner, runnerUp, purchase }) =>
        defaultDecisionPolicies.buildExplanation({
          winner: runnerUp,
          runnerUp: winner,
          purchase,
        }),
    }),
  },
];

function runMutationDefinition(
  definition: MutationDefinition,
  allScenarios: RecommendationScenario[],
  catalog: ScenarioCatalog,
): MutationResult {
  const startedAt = Date.now();
  const scenarios = allScenarios.filter(definition.scenarioFilter);
  const unexpectedErrors: string[] = [];
  const killedBy = new Set<string>();
  const survivingScenarioIds: string[] = [];

  if (!scenarios.length) {
    return {
      mutationId: definition.id,
      description: definition.description,
      scenariosRun: 0,
      selectedScenarioIds: [],
      killed: false,
      killedBy: [],
      survivingScenarioIds: [],
      unexpectedErrors: [`No deterministic scenarios selected for ${definition.id}`],
      durationMs: Date.now() - startedAt,
    };
  }

  let policies: DecisionPolicies;
  try {
    policies = definition.policies(catalog, scenarios);
  } catch (error) {
    return {
      mutationId: definition.id,
      description: definition.description,
      scenariosRun: scenarios.length,
      selectedScenarioIds: scenarios.map((scenario) => scenario.id),
      killed: false,
      killedBy: [],
      survivingScenarioIds: scenarios.map((scenario) => scenario.id),
      unexpectedErrors: [`policy setup failed: ${messageFor(error)}`],
      durationMs: Date.now() - startedAt,
    };
  }

  for (const scenario of scenarios) {
    let baseline: ScenarioValidationResult;
    let mutated: ScenarioValidationResult;
    try {
      baseline = runRecommendationScenario(scenario, catalog);
      if (!baseline.passed) {
        unexpectedErrors.push(`baseline failed for ${scenario.id}`);
        continue;
      }
      mutated = runRecommendationScenario(scenario, catalog, { policies });
    } catch (error) {
      unexpectedErrors.push(`${scenario.id}: ${messageFor(error)}`);
      continue;
    }

    const failedAssertions = mutated.assertions.filter((assertion) => !assertion.passed);
    failedAssertions.forEach((assertion) => killedBy.add(`${scenario.id}:${assertion.name}`));

    const invariantFailures = assertRecommendationInvariants([scenario], catalog, {
      policies,
    }).filter((assertion) => !assertion.passed);
    invariantFailures.forEach((assertion) => killedBy.add(`${scenario.id}:${assertion.name}`));

    if (!failedAssertions.length && !invariantFailures.length) {
      survivingScenarioIds.push(scenario.id);
    }
  }

  return {
    mutationId: definition.id,
    description: definition.description,
    scenariosRun: scenarios.length,
    selectedScenarioIds: scenarios.map((scenario) => scenario.id),
    killed: killedBy.size > 0 && unexpectedErrors.length === 0,
    killedBy: Array.from(killedBy).sort(),
    survivingScenarioIds,
    unexpectedErrors,
    durationMs: Date.now() - startedAt,
  };
}

function markWalletDecisionEligible<T extends ReturnType<DecisionPolicies["adjustWalletUsage"]>>(
  adjusted: T,
  explanation: string,
): T {
  return {
    ...adjusted,
    walletDecision: {
      ...adjusted.walletDecision,
      eligible: true,
      reason: "active",
      confidence: Math.max(adjusted.walletDecision.confidence || 0, 0.9),
      explanation,
    },
  };
}

function unownedHighValueCard(): Card {
  return {
    slug: "mutation-unowned-global-card",
    name: "Mutation Global 99% Card",
    issuer: "Mutation Bank",
    annualFee: 0,
    productionEligible: true,
    sourceUrl: "https://issuer.example/mutation-global-card",
    benefitsDetail: {
      sourceType: "issuer_official",
      sourceTitle: "Mutation Global Card",
      sourceUrl: "https://issuer.example/mutation-global-card",
      lastVerified: "2026-07-01T00:00:00.000Z",
      confidence: 0.99,
      productionEligible: true,
      rewardsFlat: [{ rate: "99%", unit: "cash" }],
    },
  } as Card;
}

function killedByToFailureCategories(killedBy: string[]): RecommendationFailureCategory[] {
  const categories = new Set<RecommendationFailureCategory>();
  killedBy.forEach((item) => {
    if (/winner|wallet-only|global catalog|owned wallet/i.test(item)) categories.add("wrong_winner");
    if (/benefit|rule|precedence/i.test(item)) categories.add("wrong_benefit");
    if (/reward|cash|valuation/i.test(item)) categories.add("valuation");
    if (/confidence/i.test(item)) categories.add("confidence");
    if (/explanation/i.test(item)) categories.add("explanation");
    if (/activation/i.test(item)) categories.add("activation_handling");
    if (/enrollment/i.test(item)) categories.add("enrollment_handling");
    if (/cap/i.test(item)) categories.add("cap_handling");
    if (/date|expiration/i.test(item)) categories.add("date_handling");
  });
  if (!categories.size && killedBy.length) categories.add("wrong_winner");
  return Array.from(categories);
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
