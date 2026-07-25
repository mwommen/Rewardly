import { evaluateScenarioWithReference } from "./recommendationReferenceEvaluator";
import type {
  RecommendationScenario,
  ScenarioCatalog,
  ScenarioPurchaseCategory,
} from "./recommendationScenario.types";

const CATEGORIES: ScenarioPurchaseCategory[] = [
  "dining",
  "grocery",
  "gas",
  "travel",
  "drugstore",
  "streaming",
  "general_retail",
  "unknown",
];

const MERCHANTS: Record<ScenarioPurchaseCategory, string[]> = {
  dining: ["Starbucks", "Local Restaurant", "Cafe Market"],
  grocery: ["Whole Foods Market", "Neighborhood Grocery"],
  gas: ["Shell", "Fuel Stop"],
  travel: ["Delta", "Marriott"],
  airfare: ["Delta"],
  hotel: ["Marriott"],
  drugstore: ["CVS", "Walgreens"],
  streaming: ["Netflix", "Spotify"],
  online_retail: ["Online Store"],
  general_retail: ["General Retailer", "Electronics Shop"],
  unknown: ["Unknown Merchant"],
};

export function generateRecommendationScenarios(input: {
  seed: number;
  count: number;
  catalog: ScenarioCatalog;
  startIndex?: number;
}): RecommendationScenario[] {
  const random = seededRandom(input.seed);
  const cardSlugs = Object.keys(input.catalog);
  const scenarios: RecommendationScenario[] = [];
  let attempts = 0;
  while (scenarios.length < input.count && attempts < input.count * 20) {
    attempts += 1;
    const index = (input.startIndex || 0) + scenarios.length;
    const walletSize = Math.max(1, Math.min(7, 1 + Math.floor(random() * Math.min(7, cardSlugs.length))));
    const walletCards = shuffle(cardSlugs, random).slice(0, walletSize);
    const category = CATEGORIES[Math.floor(random() * CATEGORIES.length)];
    const merchantOptions = MERCHANTS[category];
    const merchantName = merchantOptions[Math.floor(random() * merchantOptions.length)];
    const amount = round(1 + random() * 1500, 2);
    const confidence = category === "unknown" ? 0.5 : random() > 0.2 ? 0.92 : 0.66;
    const channel = category === "travel" && random() > 0.8 ? "issuer_portal" : "online";
    const scenario: RecommendationScenario = {
      id: `generated-${input.seed}-${index}`,
      name: `Generated ${category} scenario ${index}`,
      tags: ["generated", category],
      wallet: {
        userId: "generated-user",
        cards: walletCards.map((cardSlug) => ({ cardSlug })),
      },
      purchase: {
        merchantName,
        amount,
        currency: "USD",
        channel,
        transactionDate: "2026-07-24T00:00:00.000Z",
      },
      classification: {
        category,
        confidence,
        source: confidence >= 0.8 ? "verified_merchant_mapping" : "inferred",
        isVerified: confidence >= 0.8,
        evidence: [`seed:${input.seed}`, `index:${index}`],
      },
      expected: {
        winnerCardSlug: walletCards[0],
        winnerBenefitId: firstBenefitId(input.catalog[walletCards[0]]),
        winnerRuleType: "base",
      },
      metadata: {
        generated: true,
        generatorSeed: input.seed,
        generatorIndex: index,
      },
    };
    try {
      const reference = evaluateScenarioWithReference(scenario, input.catalog);
      scenario.expected = {
        winnerCardSlug: reference.winnerCardSlug,
        winnerBenefitId: reference.winnerBenefitId,
        winnerRuleType: reference.winnerRuleType,
        expectedReward: { cashEquivalent: reference.expectedValueUSD, tolerance: 0.05 },
        explanationMustContain: [input.catalog[reference.winnerCardSlug].name],
        explanationMustNotContain: ["Verified wallet rewards"],
      };
      scenarios.push(scenario);
    } catch {
      // Skip generated combinations that the narrow reference evaluator does not support.
    }
  }
  return scenarios;
}

function firstBenefitId(card: any) {
  const flat = card?.benefitsDetail?.rewardsFlat?.[0];
  if (flat) {
    return `${card.slug}:flat:${String(flat.rate || "").replace("%", "").replace(/\s+/g, "").toLowerCase()}`;
  }
  return `${card?.slug || "unknown-card"}:unknown-benefit`;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function round(value: number, digits = 2) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
