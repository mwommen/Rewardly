import type { Card } from "../../../packages/rewardly-core/src";
import {
  evaluateWalletDecision,
  type DecisionPolicies,
} from "../services/walletDecisionEngine";
import { assertRecommendationScenario } from "./recommendationAssertions";
import { classifyRecommendationFailures } from "./recommendationFailureClassifier";
import {
  validateRecommendationScenario,
  validateRecommendationScenarios,
} from "./recommendationScenario.schema";
import type {
  RecommendationScenario,
  ScenarioCatalog,
  ScenarioValidationResult,
} from "./recommendationScenario.types";

export function runRecommendationScenario(
  scenario: RecommendationScenario,
  catalog: ScenarioCatalog,
  options: { policies?: DecisionPolicies } = {},
): ScenarioValidationResult {
  const schemaErrors = validateRecommendationScenario(scenario, catalog);
  if (schemaErrors.length) {
    const assertions = schemaErrors.map((message) => ({
      name: "scenario definition",
      passed: false,
      message,
    }));
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed: false,
      durationMs: 0,
      expected: scenario.expected,
      actual: {},
      assertions,
      failureCategories: ["scenario_definition"],
      decisionTrace: emptyTrace(),
      reproductionCommand: reproduceCommand(scenario),
    };
  }

  const startedAt = Date.now();
  const result = evaluateWalletDecision({
    ...scenarioToWalletDecisionInput(scenario, catalog),
    policies: options.policies,
  });
  const assertions = assertRecommendationScenario(scenario, result);
  const failureCategories = classifyRecommendationFailures(assertions);
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    passed: assertions.every((assertion) => assertion.passed),
    durationMs: Date.now() - startedAt,
    expected: scenario.expected,
    actual: {
      winnerCardSlug: result.winningCard?.card.slug,
      winnerBenefitId: result.winningRule?.benefitId,
      runnerUpCardSlug: result.runnerUp?.card.slug,
      runnerUpBenefitId: result.runnerUp?.winningRule?.benefitId,
      rewardQuantity: result.estimatedReward?.quantity,
      cashEquivalent: result.estimatedReward?.valueUSD,
      confidenceScore: result.confidence.score,
      confidenceLevel: result.confidence.label,
      explanation: result.explanation,
    },
    assertions,
    failureCategories,
    decisionTrace: result,
    reproductionCommand: reproduceCommand(scenario),
  };
}

export function scenarioToWalletDecisionInput(
  scenario: RecommendationScenario,
  catalog: ScenarioCatalog,
): Parameters<typeof evaluateWalletDecision>[0] {
  const walletCards = scenario.wallet.cards.map((card) => catalog[card.cardSlug]).filter(Boolean) as Card[];
  const engineCategory =
    scenario.purchase.channel === "issuer_portal"
      ? "issuer_travel_portal"
      : scenario.classification.category;
  return {
    wallet: {
      cards: walletCards,
      cardSlugs: scenario.wallet.cards.map((card) => card.cardSlug),
    },
    purchase: {
      merchant: {
        name: scenario.purchase.normalizedMerchant || scenario.purchase.merchantName,
        category: engineCategory,
      },
      amount: scenario.purchase.amount,
      category: engineCategory,
      purchaseChannel:
        scenario.purchase.channel === "issuer_portal" ? "issuer_portal" : scenario.purchase.channel,
      classification: {
        category: scenario.classification.category,
        confidence: scenario.classification.confidence,
        source: classificationSource(scenario.classification.source),
        evidence: scenario.classification.evidence || [],
      },
    },
    walletBenefitStates: scenario.walletBenefitStates || [],
    now: new Date(scenario.purchase.transactionDate),
  };
}

export function runRecommendationScenarios(
  scenarios: RecommendationScenario[],
  catalog: ScenarioCatalog,
  options: { policies?: DecisionPolicies } = {},
): ScenarioValidationResult[] {
  validateRecommendationScenarios(scenarios, catalog);
  return scenarios.map((scenario) => runRecommendationScenario(scenario, catalog, options));
}

function classificationSource(source: RecommendationScenario["classification"]["source"]) {
  if (source === "verified_merchant_mapping" || source === "domain_mapping") {
    return "merchant_registry" as const;
  }
  if (source === "merchant_category_code") return "mcc" as const;
  if (source === "inferred") return "inferred" as const;
  return "unknown" as const;
}

function reproduceCommand(scenario: RecommendationScenario) {
  if (scenario.metadata?.generated) {
    return `npm run validate:recommendations -- --suite generated --seed ${scenario.metadata.generatorSeed} --scenario-index ${scenario.metadata.generatorIndex}`;
  }
  return `npm run validate:recommendations -- --scenario ${scenario.id}`;
}

function emptyTrace(): any {
  return {
    winningCard: null,
    runnerUp: null,
    winningRule: null,
    estimatedReward: null,
    confidence: { score: 0, label: "unknown" },
    explanation: "",
    evaluatedCards: [],
    comparison: { mode: "direct_earning_rate", explanation: "" },
    classification: { category: null, confidence: 0, source: "unknown", evidence: [], verified: false },
    auditLog: {
      decisionId: "",
      merchant: "",
      classification: { category: null, confidence: 0, source: "unknown", evidence: [], verified: false },
      evaluatedCards: [],
      appliedRules: [],
      rejectedRules: [],
      winningRule: null,
      confidence: { score: 0, label: "unknown" },
      timestamp: "",
    },
  };
}
