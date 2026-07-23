import {
  benefitFromLabel,
  buildRecommendation,
  createEmptyPaymentDecision,
  createPaymentDecision,
  type BenefitMatch,
  type Card,
  type DecisionReason,
  type PaymentDecision,
  type RecommendationPurchaseContext,
  type PurchaseContext,
  type Recommendation,
} from "../../../packages/rewardly-core/src";
import {
  recommendAllBenefits,
  recommendBestCards,
} from "./recommendationService";
import {
  resolveMerchant,
  type ResolveMerchantInput,
} from "./merchantDetectionService";
import { resolveUserWallet } from "./walletService";
import {
  explainRecommendationDecision,
  persistDecisionAuditRecord,
  type DecisionEvidenceItem,
  type DecisionWarning,
  type MissingInformation,
} from "./decisionIntelligenceService";
import { toRecommendationPurchaseContext } from "./purchaseIntelligenceService";

export type PaymentDecisionRequest = ResolveMerchantInput & {
  userId?: string;
  amount?: number;
  manualCardSlugs?: string[];
  restrictToWallet?: boolean;
  purchaseContext?: Partial<PurchaseContext>;
};

type ExistingRecommendation = {
  slug?: string;
  name?: string;
  issuer?: string;
  effectiveRate?: number;
  estValueUSD?: number;
  confidence?: number;
  reason?: string;
  matchedBenefit?: string | null;
  annualFee?: number;
  lastVerified?: string | null;
  intelligenceConfidence?: {
    score: number;
    label: "high" | "medium" | "low";
    factors?: Record<string, number>;
    reasons?: string[];
  };
  matchedBenefitId?: string | null;
  walletEvidence?: unknown[];
  purchaseRefinement?: RecommendationPurchaseContext["refinement"] | "none";
  recommendationPurchaseContext?: RecommendationPurchaseContext | null;
  explanationEvidence?: {
    merchant?: DecisionEvidenceItem[];
    benefit?: DecisionEvidenceItem[];
    wallet?: DecisionEvidenceItem[];
    scoring?: DecisionEvidenceItem[];
    missingInformation?: MissingInformation[];
    warnings?: DecisionWarning[];
  };
};

type ExistingOffer = {
  slug?: string;
  name?: string;
  issuer?: string;
  perks?: string[];
};

export async function decidePayment(
  request: PaymentDecisionRequest,
): Promise<PaymentDecision> {
  const userId = request.userId?.trim() || "devUser";
  const merchant = resolveMerchant(request);
  const wallet = await resolveUserWallet({
    userId,
    manualCardSlugs: request.manualCardSlugs,
    restrictToWallet: request.restrictToWallet ?? true,
  });

  if (!wallet.cards.length) {
    const purchase = request.purchaseContext?.purchase || null;
    const recommendationPurchaseContext = purchase
      ? toRecommendationPurchaseContext(purchase)
      : null;
    const decision = createEmptyPaymentDecision(
      wallet,
      merchant,
      "Add cards to your wallet to get personalized recommendations.",
    );
    const explanation = explainRecommendationDecision({
      userId,
      merchant,
      wallet: {
        source: wallet.source,
        cardSlugs: wallet.cardSlugs,
        benefitStates: wallet.benefitStates as any,
      },
      recommendations: [],
      generatedAt: decision.generatedAt,
    });
    persistDecisionAuditRecord(explanation);
    return {
      ...decision,
      purchase,
      recommendationPurchaseContext,
      decisionExplanation: explanation,
    };
  }

  const restrictToWallet = request.restrictToWallet ?? true;
  const allowedCardSlugs = restrictToWallet ? wallet.cardSlugs : undefined;
  const enrollmentState = benefitEnrollmentState(wallet.benefitStates);
  const purchase = request.purchaseContext?.purchase || null;
  const recommendationPurchaseContext = purchase
    ? toRecommendationPurchaseContext(purchase)
    : null;
  const amount = request.amount ?? recommendationPurchaseContext?.total ?? undefined;

  const [bestResult, offerResult] = await Promise.all([
    recommendBestCards({
      merchant: merchant.name,
      amount,
      mcc: merchant.mcc || request.mcc || undefined,
      allowedCardSlugs,
      merchantConfidence: merchant.confidence,
      scoringMode: "strict_production",
      enrolledBenefitIds: enrollmentState.enrolledBenefitIds,
      activatedBenefitIds: enrollmentState.activatedBenefitIds,
      knownEnrollmentBenefitIds: enrollmentState.knownEnrollmentBenefitIds,
      knownActivationBenefitIds: enrollmentState.knownActivationBenefitIds,
      walletBenefitStates: wallet.benefitStates as any,
      recommendationPurchaseContext,
    }),
    recommendAllBenefits({
      merchant: merchant.name,
      amount,
      mcc: merchant.mcc || request.mcc || undefined,
      minRate: -1,
      allowedCardSlugs,
      merchantConfidence: merchant.confidence,
      scoringMode: "strict_production",
      enrolledBenefitIds: enrollmentState.enrolledBenefitIds,
      activatedBenefitIds: enrollmentState.activatedBenefitIds,
      knownEnrollmentBenefitIds: enrollmentState.knownEnrollmentBenefitIds,
      knownActivationBenefitIds: enrollmentState.knownActivationBenefitIds,
      walletBenefitStates: wallet.benefitStates as any,
      recommendationPurchaseContext,
    }),
  ]);

  const walletSlugs = new Set(wallet.cards.map((card) => card.slug));
  const offers = (offerResult.offers || []).filter((offer: ExistingOffer) =>
    walletSlugs.has(String(offer.slug || "")),
  );
  const recommendations = (bestResult.recommendations || [])
    .filter((item: ExistingRecommendation) =>
      walletSlugs.has(String(item.slug || "")),
    )
    .map((item: ExistingRecommendation) =>
      toDecisionRecommendation(item, wallet.cards, offers),
    );

  const decision = createPaymentDecision({
    wallet,
    merchant,
    recommendations,
  });
  const explanation = explainRecommendationDecision({
    userId,
    merchant,
    wallet: {
      source: wallet.source,
      cardSlugs: wallet.cardSlugs,
      benefitStates: wallet.benefitStates as any,
    },
    recommendations: bestResult.recommendations || [],
    generatedAt: decision.generatedAt,
  });
  persistDecisionAuditRecord(explanation);
  return {
    ...decision,
    purchase,
    recommendationPurchaseContext,
    decisionExplanation: explanation,
  };
}

function benefitEnrollmentState(
  states: Array<{
    benefitKey?: string;
    benefitId?: string;
    enrolled?: boolean;
    enrollmentStatus?: string;
    activationStatus?: string;
  }> = [],
) {
  const knownEnrollmentBenefitIds: string[] = [];
  const enrolledBenefitIds: string[] = [];
  const knownActivationBenefitIds: string[] = [];
  const activatedBenefitIds: string[] = [];

  for (const state of states) {
    const key = String(state?.benefitId || state?.benefitKey || "").trim();
    if (!key) continue;
    if (
      state.enrollmentStatus &&
      !["unknown", "not_required"].includes(state.enrollmentStatus)
    ) {
      knownEnrollmentBenefitIds.push(key);
    } else if (state.benefitKey) {
      knownEnrollmentBenefitIds.push(key);
    }
    if (state.enrolled || state.enrollmentStatus === "enrolled") {
      enrolledBenefitIds.push(key);
    }
    if (
      state.activationStatus &&
      !["unknown", "not_required"].includes(state.activationStatus)
    ) {
      knownActivationBenefitIds.push(key);
    }
    if (state.activationStatus === "activated") activatedBenefitIds.push(key);
  }

  return {
    knownEnrollmentBenefitIds,
    enrolledBenefitIds,
    knownActivationBenefitIds,
    activatedBenefitIds,
  };
}

function toDecisionRecommendation(
  item: ExistingRecommendation,
  walletCards: Card[],
  offers: ExistingOffer[],
): Recommendation {
  const card =
    walletCards.find((walletCard) => walletCard.slug === item.slug) ||
    fallbackCard(item);
  const matchedOffer = offers.find((offer) => offer.slug === item.slug);
  const benefitLabels = [
    item.matchedBenefit,
    ...(matchedOffer?.perks || []),
  ].filter(Boolean) as string[];

  return buildRecommendation({
    card,
    primaryReason: primaryReasonFor(item, benefitLabels),
    rewardEstimate: {
      label: rewardLabel(item.effectiveRate),
      effectiveRate: item.effectiveRate,
      estimatedValueUSD: item.estValueUSD,
    },
    confidence: item.intelligenceConfidence,
    unlockedBenefits: benefitLabels
      .slice(0, 4)
      .map((label) => toBenefitMatch(label, card)),
  });
}

function fallbackCard(item: ExistingRecommendation): Card {
  const slug = String(item.slug || item.name || "unknown-card")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return {
    slug,
    name: item.name || slug,
    issuer: item.issuer || null,
    annualFee: Number.isFinite(item.annualFee) ? item.annualFee || 0 : null,
    lastVerified: item.lastVerified || null,
  };
}

function primaryReasonFor(
  item: ExistingRecommendation,
  benefitLabels: string[],
): DecisionReason {
  const firstBenefit = benefitLabels[0];
  if (firstBenefit) {
    return {
      label: "Benefit unlocked",
      detail: firstBenefit,
      kind: /protection|insurance|warranty/i.test(firstBenefit)
        ? "protection"
        : "benefit",
    };
  }

  if (typeof item.effectiveRate === "number" && item.effectiveRate > 0) {
    return {
      label: "Best rewards",
      detail: rewardLabel(item.effectiveRate),
      kind: "reward",
    };
  }

  return {
    label: "Best available card",
    detail: item.reason || "Strongest option in this wallet.",
    kind: "fallback",
  };
}

function toBenefitMatch(label: string, card: Card): BenefitMatch {
  return {
    benefit: benefitFromLabel(label),
    card: {
      slug: card.slug,
      name: card.name,
      issuer: card.issuer,
    },
    summary: label,
    requirement:
      "You usually need to pay with this card for the benefit to apply.",
  };
}

function rewardLabel(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return "strong available rewards";
  }
  if (rate < 1) {
    const percent = rate * 100;
    return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}% value`;
  }
  return `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1)}x rewards`;
}
