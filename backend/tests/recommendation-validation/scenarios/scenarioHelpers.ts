import { evaluateScenarioWithReference } from "../../../src/validation/recommendationReferenceEvaluator";
import type {
  RecommendationScenario,
  ScenarioClassificationSource,
  ScenarioPurchaseCategory,
  ScenarioRuleType,
} from "../../../src/validation/recommendationScenario.types";
import { recommendationValidationCatalog } from "../fixtures/cards/catalog";

const catalog = recommendationValidationCatalog();

export function hydratedScenario(input: {
  id: string;
  name: string;
  tags: string[];
  wallet: string[];
  merchantName: string;
  category: ScenarioPurchaseCategory;
  amount: number;
  channel?: "online" | "in_store" | "issuer_portal";
  transactionDate?: string;
  confidence?: number;
  source?: ScenarioClassificationSource;
  verified?: boolean;
  walletBenefitStates?: RecommendationScenario["walletBenefitStates"];
  expectedRuleType?: ScenarioRuleType;
  mustContain?: string[];
  mustNotContain?: string[];
  assumptions?: string[];
}): RecommendationScenario {
  const confidence = input.confidence ?? 0.92;
  const scenario: RecommendationScenario = {
    id: input.id,
    name: input.name,
    tags: input.tags,
    wallet: {
      userId: "recommendation-validation-user",
      cards: input.wallet.map((cardSlug) => ({ cardSlug })),
    },
    purchase: {
      merchantName: input.merchantName,
      amount: input.amount,
      currency: "USD",
      channel: input.channel || "online",
      transactionDate: input.transactionDate || "2026-07-24T00:00:00.000Z",
    },
    classification: {
      category: input.category,
      confidence,
      source: input.source || (confidence >= 0.8 ? "verified_merchant_mapping" : "inferred"),
      isVerified: input.verified ?? confidence >= 0.8,
      evidence: [`fixture:${input.id}`],
    },
    walletBenefitStates: input.walletBenefitStates,
    expected: {
      winnerCardSlug: input.wallet[0],
      winnerBenefitId: "placeholder",
      winnerRuleType: input.expectedRuleType || "base",
    },
    metadata: {
      ruleType: input.expectedRuleType,
      assumptions: input.assumptions,
    },
  };
  const reference = evaluateScenarioWithReference(scenario, catalog);
  return {
    ...scenario,
    expected: {
      winnerCardSlug: reference.winnerCardSlug,
      winnerBenefitId: reference.winnerBenefitId,
      winnerRuleType: reference.winnerRuleType,
      expectedReward: {
        cashEquivalent: reference.expectedValueUSD,
        tolerance: 0.05,
      },
      explanationMustContain: [
        catalog[reference.winnerCardSlug].name,
        ...(input.mustContain || []),
      ],
      explanationMustNotContain: [
        "Verified wallet rewards",
        "Calculated after checkout total",
        ...(input.mustNotContain || []),
      ],
    },
  };
}

export function expandScenarioSet(input: {
  prefix: string;
  tag: string;
  merchantName: string;
  category: ScenarioPurchaseCategory;
  wallet: string[];
  amounts: number[];
  expectedRuleType?: ScenarioRuleType;
  walletBenefitStates?: RecommendationScenario["walletBenefitStates"];
  confidence?: number;
  source?: ScenarioClassificationSource;
}) {
  return input.amounts.map((amount, index) =>
    hydratedScenario({
      id: `${input.prefix}-${String(index + 1).padStart(3, "0")}`,
      name: `${input.tag} validation ${index + 1}`,
      tags: ["curated", input.tag],
      wallet: input.wallet,
      merchantName: input.merchantName,
      category: input.category,
      amount,
      expectedRuleType: input.expectedRuleType,
      walletBenefitStates: input.walletBenefitStates,
      confidence: input.confidence,
      source: input.source,
    }),
  );
}
