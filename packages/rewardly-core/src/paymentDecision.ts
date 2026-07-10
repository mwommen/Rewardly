import type {
  Benefit,
  BenefitMatch,
  Card,
  DecisionReason,
  Merchant,
  PaymentDecision,
  Recommendation,
  Wallet,
} from "./domain";

export type PaymentDecisionInput = {
  wallet: Wallet;
  merchant: Merchant;
  recommendations: Recommendation[];
  generatedAt?: string;
};

export function createEmptyPaymentDecision(
  wallet: Wallet,
  merchant: Merchant,
  summary = "Rewardly could not find a confident card recommendation yet.",
): PaymentDecision {
  return {
    recommendedCard: null,
    alternativeCards: [],
    primaryReason: null,
    unlockedBenefits: [],
    confidence: { label: "unknown" },
    recommendationSummary: summary,
    merchant,
    wallet: {
      userId: wallet.userId,
      source: wallet.source,
      cardSlugs: wallet.cardSlugs,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function createPaymentDecision({
  wallet,
  merchant,
  recommendations,
  generatedAt = new Date().toISOString(),
}: PaymentDecisionInput): PaymentDecision {
  const [recommendedCard, ...alternatives] = recommendations;

  if (!recommendedCard) {
    return createEmptyPaymentDecision(
      wallet,
      merchant,
      "Rewardly did not find a strong card in your wallet for this checkout.",
    );
  }

  const unlockedBenefits = recommendations.flatMap(
    (recommendation) => recommendation.unlockedBenefits,
  );

  return {
    recommendedCard,
    alternativeCards: alternatives.slice(0, 2),
    primaryReason: recommendedCard.primaryReason,
    rewardEstimate: recommendedCard.rewardEstimate,
    unlockedBenefits: dedupeBenefitMatches(unlockedBenefits),
    confidence: confidenceFromRecommendation(recommendedCard),
    recommendationSummary: summaryFor(recommendedCard, merchant),
    contextualInsight: insightFor(recommendedCard),
    merchant,
    wallet: {
      userId: wallet.userId,
      source: wallet.source,
      cardSlugs: wallet.cardSlugs,
    },
    generatedAt,
  };
}

export function buildRecommendation(params: {
  card: Card;
  primaryReason: DecisionReason;
  rewardEstimate?: Recommendation["rewardEstimate"];
  unlockedBenefits?: BenefitMatch[];
}): Recommendation {
  return {
    card: params.card,
    primaryReason: params.primaryReason,
    rewardEstimate: params.rewardEstimate,
    unlockedBenefits: params.unlockedBenefits || [],
  };
}

export function benefitFromLabel(
  label: string,
  overrides: Partial<Benefit> = {},
) {
  return {
    label,
    type: inferBenefitType(label),
    ...overrides,
  } satisfies Benefit;
}

function confidenceFromRecommendation(recommendation: Recommendation) {
  const hasBenefit = recommendation.unlockedBenefits.length > 0;
  const hasRewardRate = Boolean(recommendation.rewardEstimate?.effectiveRate);
  if (hasBenefit && hasRewardRate)
    return { label: "high" as const, score: 0.86 };
  if (hasBenefit || hasRewardRate)
    return { label: "medium" as const, score: 0.68 };
  return { label: "low" as const, score: 0.42 };
}

function summaryFor(recommendation: Recommendation, merchant: Merchant) {
  const merchantName = merchant.name || "this purchase";
  if (recommendation.unlockedBenefits.length) {
    return `Use ${recommendation.card.name} at ${merchantName} because it unlocks a card benefit before you pay.`;
  }
  if (recommendation.rewardEstimate?.label) {
    return `Use ${recommendation.card.name} at ${merchantName} because it gives you ${recommendation.rewardEstimate.label}.`;
  }
  return `Use ${recommendation.card.name} for the strongest available value in your wallet.`;
}

function insightFor(recommendation: Recommendation) {
  const firstBenefit = recommendation.unlockedBenefits[0]?.benefit.label;
  if (!firstBenefit) {
    return "Rewardly compares the cards you already own before you pay.";
  }
  if (/protection|insurance|warranty/i.test(firstBenefit)) {
    return "Protections usually only apply when you pay with the card that includes them.";
  }
  if (/credit/i.test(firstBenefit)) {
    return "Credits can expire or require enrollment, so the right card matters at checkout.";
  }
  return "Card benefits are easy to miss unless you check them before paying.";
}

function dedupeBenefitMatches(matches: BenefitMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.card.slug}:${match.benefit.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferBenefitType(label: string): Benefit["type"] {
  if (/credit|cash/i.test(label)) return "credit";
  if (/protection|warranty/i.test(label)) return "protection";
  if (/insurance|coverage/i.test(label)) return "insurance";
  if (/lounge|precheck|global entry|travel/i.test(label)) return "travel_perk";
  if (/offer/i.test(label)) return "offer";
  return "other";
}
