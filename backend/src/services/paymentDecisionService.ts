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
  type RecommendationWinningReason,
} from "../../../packages/rewardly-core/src";
import {
  recommendAllBenefits,
  recommendBestCards,
} from "./recommendationService";
import {
  resolveMerchant,
  type ResolveMerchantInput,
} from "./merchantDetectionService";
import {
  evaluateMerchantIntelligence,
  merchantDecisionInputAdapter,
  type MerchantIntelligenceInput,
} from "./merchantIntelligenceService";
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
  merchantSignals?: Partial<MerchantIntelligenceInput>;
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
  matchTier?: string;
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
  const merchantIntelligence = evaluateMerchantIntelligence({
    url: request.merchantSignals?.url || request.url || "",
    hostname: request.merchantSignals?.hostname || request.hostname || "",
    pageTitle: request.merchantSignals?.pageTitle || request.title || "",
    documentTextSignals: request.merchantSignals?.documentTextSignals || [],
    structuredData: request.merchantSignals?.structuredData || [],
    detectedMerchantLabel:
      request.merchantSignals?.detectedMerchantLabel || request.merchant || "",
    checkoutProviderSignals:
      request.merchantSignals?.checkoutProviderSignals || [],
    domSignals: request.merchantSignals?.domSignals || [],
    purchaseChannelHint: request.merchantSignals?.purchaseChannelHint,
    checkoutStage:
      request.merchantSignals?.checkoutStage ||
      request.purchaseContext?.checkoutStage ||
      undefined,
    transactionDate:
      request.merchantSignals?.transactionDate ||
      request.purchaseContext?.timestamp ||
      new Date().toISOString(),
  });
  const merchantIntelligenceMode = resolveMerchantIntelligenceMode();
  const legacyMerchant = resolveMerchant(request);
  const merchantAdapterInput =
    merchantIntelligenceMode === "merchant-intelligence"
      ? merchantDecisionInputAdapter(merchantIntelligence)
      : {};
  const merchant =
    merchantIntelligenceMode === "merchant-intelligence"
      ? resolveMerchant({
          ...request,
          ...merchantAdapterInput,
        })
      : legacyMerchant;
  const merchantIntelligenceDiagnostics = {
    ...merchantIntelligence,
    rolloutMode: merchantIntelligenceMode,
    shadowDiscrepancy:
      merchantIntelligenceMode === "shadow"
        ? buildMerchantShadowDiscrepancy(legacyMerchant, merchantIntelligence)
        : null,
  };
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
      merchantIntelligence: merchantIntelligenceDiagnostics,
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
      toDecisionRecommendation(item, wallet.cards, offers, merchant),
    );

  const decision = createPaymentDecision({
    wallet,
    merchant,
    recommendations,
    purchaseAmount: amount ?? null,
  });
  tracePaymentDecisionBoundary("paymentDecisionService-output", decision);
  tracePaymentDecisionBoundary("canonical-paymentDecision-output", decision);
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
    merchantIntelligence: merchantIntelligenceDiagnostics,
  };
}

function resolveMerchantIntelligenceMode() {
  const mode = String(
    process.env.REWARDLY_MERCHANT_INTELLIGENCE_MODE || "shadow",
  ).trim();
  if (mode === "legacy" || mode === "shadow" || mode === "merchant-intelligence") {
    return mode;
  }
  return "shadow";
}

function buildMerchantShadowDiscrepancy(
  legacyMerchant: ReturnType<typeof resolveMerchant>,
  merchantIntelligence: ReturnType<typeof evaluateMerchantIntelligence>,
) {
  const normalizedLegacyMerchant = legacyMerchant.name || null;
  const normalizedNewMerchant = merchantIntelligence.identity?.displayName || null;
  const legacyCategory = legacyMerchant.category || null;
  const newCategory =
    merchantIntelligence.classification.primaryCategory === "unknown"
      ? null
      : merchantIntelligence.classification.primaryCategory;
  const legacyChannel = "online_direct";
  const newChannel = merchantIntelligence.context.purchaseChannel;
  const differences = [
    normalizedLegacyMerchant !== normalizedNewMerchant ? "merchant" : null,
    legacyCategory !== newCategory ? "category" : null,
    legacyChannel !== newChannel ? "channel" : null,
  ].filter(Boolean);
  return {
    normalizedLegacyMerchant,
    normalizedNewMerchant,
    legacyCategory,
    newCategory,
    legacyChannel,
    newChannel,
    newConfidenceBand: merchantIntelligence.confidence.band,
    discrepancyType: differences.length ? differences.join("_") : "equivalent",
    registryVersion: merchantIntelligence.registryVersion,
    correlationId: `mi-${merchantIntelligence.registryVersion}-${String(
      normalizedLegacyMerchant || normalizedNewMerchant || "unknown",
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}`,
  };
}

function tracePaymentDecisionBoundary(label: string, decision: PaymentDecision) {
  if (process.env.REWARDLY_TRACE_DECISION !== "true") return;
  console.log(`[Rewardly] ${label}`, {
    merchant: decision.merchant?.name || null,
    recommendedCard:
      decision.recommendedCard?.card.slug ||
      decision.recommendedCard?.card.name ||
      null,
    winningReasonType: decision.winningReason?.type || null,
    winningRuleId: decision.winningReason?.sourceRuleId || null,
    winningBenefitId: decision.winningReason?.sourceBenefitId || null,
    narrativeHeadline: decision.decisionNarrative?.headline || null,
    integrityValid: decision.recommendationIntegrity?.valid ?? null,
    integrityFailureReasons: decision.recommendationIntegrity?.reason
      ? [decision.recommendationIntegrity.reason]
      : [],
  });
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
  _offers: ExistingOffer[],
  merchant: ReturnType<typeof resolveMerchant>,
): Recommendation {
  const card =
    walletCards.find((walletCard) => walletCard.slug === item.slug) ||
    fallbackCard(item);
  const decisionCard = cardForDecisionPayload(card);
  const benefitLabels = [item.matchedBenefit].filter(Boolean) as string[];
  const winningReason = winningReasonForItem(item, card, merchant);
  const relevantBenefits = relevantBenefitsFor(item, decisionCard, winningReason);

  return buildRecommendation({
    card: decisionCard,
    primaryReason: primaryReasonFor(item, benefitLabels, winningReason),
    rewardEstimate: {
      label: winningReason?.title || rewardLabel(item.effectiveRate, card),
      effectiveRate: item.effectiveRate,
      estimatedValueUSD: item.estValueUSD,
    },
    confidence: item.intelligenceConfidence,
    unlockedBenefits: relevantBenefits,
    relevantBenefits,
    winningReason,
  });
}

function cardForDecisionPayload(card: Card): Card {
  return {
    slug: card.slug,
    name: card.name,
    issuer: card.issuer,
    annualFee: card.annualFee,
    sourceUrl: card.sourceUrl,
    lastVerified: card.lastVerified,
  };
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
  winningReason?: RecommendationWinningReason | null,
): DecisionReason {
  if (winningReason) {
    return {
      label: "Why this wins",
      detail: winningReason.explanation,
      kind: winningReason.type.includes("reward") ? "reward" : "benefit",
    };
  }

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

function toBenefitMatch(
  label: string,
  card: Card,
  benefitId?: string | null,
): BenefitMatch {
  return {
    benefit: benefitFromLabel(label, benefitId ? { id: benefitId } : {}),
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

function winningReasonForItem(
  item: ExistingRecommendation,
  card: Card,
  merchant: ReturnType<typeof resolveMerchant>,
): RecommendationWinningReason | null {
  const merchantName = merchant.name || "this purchase";
  if (item.matchedBenefit) {
    return {
      type: reasonTypeForItem(item),
      merchantName,
      title: item.matchedBenefit,
      explanation: explanationForMatchedBenefit(
        item.matchedBenefit,
        merchantName,
      ),
      rewardRate: item.effectiveRate,
      rewardUnit: rewardUnitFor(card),
      estimatedValue: item.estValueUSD,
      applicableToPurchase: true,
      influencedRecommendation: true,
      sourceBenefitId: item.matchedBenefitId || undefined,
    };
  }

  if (
    typeof item.effectiveRate !== "number" ||
    !Number.isFinite(item.effectiveRate) ||
    item.effectiveRate <= 0
  ) {
    return null;
  }

  const title =
    catchAllEarningLabel(card.perks || [], item.effectiveRate) ||
    rewardLabel(item.effectiveRate, card);
  return {
    type: "catch_all_reward",
    merchantName,
    title,
    explanation: `Earn ${rewardLabel(
      item.effectiveRate,
      card,
      rewardUnitFor(card),
    )} on ${purchasePhraseFor(merchantName)}.`,
    rewardRate: item.effectiveRate,
    rewardUnit: rewardUnitFor(card),
    estimatedValue: item.estValueUSD,
    applicableToPurchase: true,
    influencedRecommendation: true,
    sourceRuleId: `${card.slug}:catch_all_reward`,
  };
}

function relevantBenefitsFor(
  item: ExistingRecommendation,
  card: Card,
  winningReason: RecommendationWinningReason | null,
) {
  if (item.matchedBenefit) {
    return [toBenefitMatch(item.matchedBenefit, card, item.matchedBenefitId)];
  }
  if (winningReason?.type === "catch_all_reward") {
    return [toBenefitMatch(winningReason.title, card)];
  }
  return [];
}

function reasonTypeForItem(
  item: ExistingRecommendation,
): RecommendationWinningReason["type"] {
  if (item.matchTier === "exact_benefit") {
    if (/offer/i.test(item.matchedBenefit || "")) return "merchant_offer";
    if (/credit|statement/i.test(item.matchedBenefit || "")) {
      return "merchant_credit";
    }
    return "merchant_reward";
  }
  if (item.matchTier === "category_match") return "category_reward";
  return "other";
}

function explanationForMatchedBenefit(label: string, merchantName: string) {
  if (/at|with|on/i.test(label)) return label;
  return `${label} applies to this ${merchantName} purchase.`;
}

function catchAllEarningLabel(perks: string[], rate: number) {
  const expectedRates = [rateMultiplierLabel(rate), ratePercentLabel(rate)];
  if (rate < 1) expectedRates.push(rateMultiplierLabel(rate * 100));
  const match = perks.find(
    (perk) =>
      /\b(every|all|all other|everyday)\b/i.test(perk) &&
      expectedRates.some((expectedRate) =>
        new RegExp(escapeRegExp(expectedRate), "i").test(perk),
      ),
  );
  if (!match) return null;
  return match.trim().replace(/[.。]+$/g, "");
}

function rewardLabel(
  rate?: number,
  card?: Card,
  unitOverride?: RecommendationWinningReason["rewardUnit"],
) {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return "strong available rewards";
  }
  const unit = unitOverride || (card ? rewardUnitFor(card) : "percent");
  if (unit === "miles") {
    const program = card ? rewardProgramLabelFor(card) : "miles";
    return `${rateMultiplierLabel(rateMultiplier(rate))} ${program}`;
  }
  if (unit === "points") {
    return `${rateMultiplierLabel(rateMultiplier(rate))} points`;
  }
  if (unit === "cash") return `${rateMultiplierLabel(rate)} cash back`;
  if (rate < 1) return `${ratePercentLabel(rate)} cash back`;
  return `${rateMultiplierLabel(rate)} rewards`;
}

function purchasePhraseFor(merchantName: string) {
  if (!merchantName || /^this purchase$/i.test(merchantName)) {
    return "this purchase";
  }
  return `this ${merchantName} purchase`;
}

function rateMultiplierLabel(rate: number) {
  return `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1)}x`;
}

function rateMultiplier(rate: number) {
  return rate < 1 ? rate * 100 : rate;
}

function ratePercentLabel(rate: number) {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function rewardUnitFor(card: Card): RecommendationWinningReason["rewardUnit"] {
  const text = `${card.name} ${(card.perks || []).join(" ")}`.toLowerCase();
  if (/mile/.test(text)) return "miles";
  if (/point|membership reward/.test(text)) return "points";
  if (/cash/.test(text)) return "cash";
  return "percent";
}

function rewardProgramLabelFor(card: Card) {
  const text = `${card.name} ${(card.perks || []).join(" ")}`.toLowerCase();
  if (/venture/.test(text)) return "Venture Miles";
  return "miles";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
