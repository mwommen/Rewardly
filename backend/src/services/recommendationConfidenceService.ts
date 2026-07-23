import { scoreBenefitFreshness } from "./benefitIntelligenceService";

export type RecommendationConfidenceInput = {
  matchTier?: string | null;
  merchantConfidence?: number | null;
  benefitConfidence?: number | null;
  lastVerified?: string | null;
  walletCardCount?: number;
  hasMatchedBenefit?: boolean;
};

export type RecommendationConfidence = {
  score: number;
  label: "high" | "medium" | "low";
  factors: {
    matchQuality: number;
    merchant: number;
    benefitFreshness: number;
    walletCompleteness: number;
  };
  reasons: string[];
};

export function scoreRecommendationConfidence(
  input: RecommendationConfidenceInput,
): RecommendationConfidence {
  const matchQuality = matchQualityScore(input.matchTier, input.hasMatchedBenefit);
  const merchant = clamp(input.merchantConfidence ?? 0.55);
  const benefitFreshness = Math.min(
    scoreBenefitFreshness(input.lastVerified),
    clamp(input.benefitConfidence ?? 0.78),
  );
  const walletCompleteness = walletCompletenessScore(input.walletCardCount);

  const score = clamp(
    matchQuality * 0.38 +
      merchant * 0.26 +
      benefitFreshness * 0.24 +
      walletCompleteness * 0.12,
  );

  return {
    score,
    label: score >= 0.8 ? "high" : score >= 0.58 ? "medium" : "low",
    factors: {
      matchQuality,
      merchant,
      benefitFreshness,
      walletCompleteness,
    },
    reasons: confidenceReasons({
      score,
      matchQuality,
      merchant,
      benefitFreshness,
      walletCompleteness,
    }),
  };
}

function matchQualityScore(matchTier?: string | null, hasBenefit?: boolean) {
  if (matchTier === "exact_benefit" || hasBenefit) return 0.92;
  if (matchTier === "category_match") return 0.74;
  if (matchTier === "base_rate") return 0.55;
  return 0.45;
}

function walletCompletenessScore(cardCount?: number) {
  if (!cardCount) return 0.3;
  if (cardCount === 1) return 0.62;
  if (cardCount <= 3) return 0.78;
  return 0.88;
}

function confidenceReasons(input: {
  score: number;
  matchQuality: number;
  merchant: number;
  benefitFreshness: number;
  walletCompleteness: number;
}) {
  const reasons: string[] = [];
  if (input.matchQuality < 0.6) reasons.push("weak_match_quality");
  if (input.merchant < 0.7) reasons.push("uncertain_merchant_mapping");
  if (input.benefitFreshness < 0.7) reasons.push("benefit_needs_reverification");
  if (input.walletCompleteness < 0.65) reasons.push("limited_wallet_context");
  if (!reasons.length) reasons.push("strong_internal_confidence");
  return reasons;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
