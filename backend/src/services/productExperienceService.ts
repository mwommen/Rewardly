import type {
  PaymentDecision,
  PurchaseCategory,
  PurchaseConfidenceLabel,
} from "../../../packages/rewardly-core/src";
import {
  detectOpportunities,
  type CanonicalOpportunity,
  type OpportunityDetectionContext,
} from "./opportunityIntelligenceService";

export type RecommendationState =
  | "loading"
  | "merchant_detected"
  | "analyzing_purchase"
  | "recommendation_ready"
  | "no_recommendation"
  | "low_confidence"
  | "wallet_information_missing"
  | "merchant_unknown"
  | "benefit_expired"
  | "engine_error"
  | "offline";

export type RecommendationLifecycleStage =
  | "merchant_detected"
  | "recommendation_requested"
  | "decision_generated"
  | "presentation_generated"
  | "displayed_to_user"
  | "user_interaction"
  | "dismissed"
  | "saved"
  | "viewed"
  | "analytics_recorded";

export type RecommendationAction =
  | "dismiss"
  | "save"
  | "expand_details"
  | "view_explanation"
  | "ignore"
  | "never_show_again"
  | "mark_incorrect"
  | "open_dashboard";

export type FeedbackEventType =
  | "recommendation_accepted"
  | "recommendation_ignored"
  | "recommendation_dismissed"
  | "wrong_merchant"
  | "wrong_card"
  | "wrong_benefit"
  | "incorrect_wallet_state"
  | "user_override";

export type ProductAnalyticsEventType =
  | "merchant_detected"
  | "recommendation_displayed"
  | "recommendation_clicked"
  | "dismissed"
  | "saved"
  | "error"
  | "unknown_merchant"
  | "low_confidence"
  | "wallet_missing";

export type ProductPerformanceMetric =
  | "merchant_detection_ms"
  | "recommendation_generation_ms"
  | "presentation_generation_ms"
  | "popup_display_ms";

export type ProductPerformanceTargets = Record<ProductPerformanceMetric, number>;

export type PresentationAction = {
  action: RecommendationAction;
  label: string;
  primary: boolean;
};

export type RecommendationPresentationModel = {
  presentationId: string;
  state: RecommendationState;
  recommendationSummary: string;
  recommendedCard: {
    slug: string;
    displayName: string;
    issuer: string | null;
    annualFee: number | null;
    logoKey: string;
  } | null;
  estimatedValue: {
    label: string;
    amountUSD: number | null;
    effectiveRate: number | null;
  } | null;
  confidence: {
    label: "high" | "medium" | "low" | "unknown";
    score: number | null;
    userFacingLabel: string;
  };
  explanation: {
    headline: string;
    primaryReason: string;
    supportingReasons: string[];
    contextualInsight: string | null;
  };
  opportunitySummary: {
    headline: string;
    benefits: string[];
    savingsCue: string | null;
  };
  proactiveOpportunities: Array<{
    opportunityId: string;
    title: string;
    summary: string;
    priority: string;
    estimatedValueUSD: number;
    actionRequired: string;
  }>;
  merchantSummary: {
    name: string;
    category: string | null;
    hostname: string | null;
  };
  walletSummary: {
    cardCount: number;
    source: string;
    cardSlugs: string[];
    missingInformation: string[];
  };
  purchaseSummary: string | null;
  purchaseConfidence: {
    label: PurchaseConfidenceLabel;
    score: number;
  } | null;
  dominantCategory: PurchaseCategory | null;
  exclusionsSummary: string | null;
  mixedCartWarning: string | null;
  availableActions: PresentationAction[];
  generatedAt: string;
  performance: {
    targetMs: ProductPerformanceTargets;
    actualMs: Partial<ProductPerformanceTargets>;
    withinTargets: boolean;
  };
};

export type RecommendationLifecycleEvent = {
  lifecycleId: string;
  stage: RecommendationLifecycleStage;
  merchantName: string | null;
  recommendationState: RecommendationState;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type ProductFeedbackEvent = {
  feedbackId: string;
  type: FeedbackEventType;
  userId: string | null;
  installationId: string | null;
  presentationId: string | null;
  merchantName: string | null;
  cardSlug: string | null;
  reason: string | null;
  createdAt: string;
};

export type ProductAnalyticsEvent = {
  eventId: string;
  type: ProductAnalyticsEventType;
  userId: string | null;
  installationId: string | null;
  surface: "extension" | "website" | "mobile" | "backend";
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DashboardExperienceModel = {
  userId: string;
  currentWallet: {
    cardSlugs: string[];
    cardCount: number;
  };
  activeBenefits: string[];
  expiringBenefits: string[];
  recentRecommendations: RecommendationPresentationModel[];
  recommendationHistory: RecommendationLifecycleEvent[];
  savingsSummary: {
    estimatedValueUSD: number;
    recommendationCount: number;
  };
  opportunitySummary: {
    headline: string;
    opportunities: string[];
  };
  mostUsedCards: Array<{
    cardSlug: string;
    recommendationCount: number;
  }>;
};

export const PRODUCT_PERFORMANCE_TARGETS: ProductPerformanceTargets = {
  merchant_detection_ms: 200,
  recommendation_generation_ms: 500,
  presentation_generation_ms: 100,
  popup_display_ms: 1000,
};

export const RECOMMENDATION_STATES: RecommendationState[] = [
  "loading",
  "merchant_detected",
  "analyzing_purchase",
  "recommendation_ready",
  "no_recommendation",
  "low_confidence",
  "wallet_information_missing",
  "merchant_unknown",
  "benefit_expired",
  "engine_error",
  "offline",
];

export function generateRecommendationPresentation(input: {
  decision: PaymentDecision;
  opportunities?: CanonicalOpportunity[];
  opportunityContext?: Omit<OpportunityDetectionContext, "decision">;
  actualPerformanceMs?: Partial<ProductPerformanceTargets>;
  generatedAt?: string;
}): RecommendationPresentationModel {
  const startedAt = Date.now();
  const generatedAt = input.generatedAt || new Date().toISOString();
  const decision = input.decision;
  const purchaseContext = decision.recommendationPurchaseContext || null;
  const recommendation = decision.recommendedCard;
  const card = recommendation?.card || null;
  const benefits = (decision.unlockedBenefits || [])
    .map((match) => match?.benefit?.label || match?.summary)
    .filter(Boolean)
    .slice(0, 4) as string[];
  const state = stateForDecision(decision);
  const opportunities =
    input.opportunities ||
    detectOpportunities({
      userId:
        input.opportunityContext?.userId ||
        decision.wallet?.userId ||
        "unknown-user",
      walletBenefitStates: input.opportunityContext?.walletBenefitStates || [],
      now: input.opportunityContext?.now,
      historicalBehavior: input.opportunityContext?.historicalBehavior,
      decision,
    });
  const actualPerformance = {
    ...input.actualPerformanceMs,
    presentation_generation_ms:
      input.actualPerformanceMs?.presentation_generation_ms ??
      Math.max(1, Date.now() - startedAt),
  };

  return {
    presentationId: stableId("presentation", [
      decision.generatedAt,
      decision.merchant?.name,
      card?.slug,
      decision.wallet?.cardSlugs?.join(","),
    ]),
    state,
    recommendationSummary: summaryForDecision(decision),
    recommendedCard: card
      ? {
          slug: card.slug,
          displayName: card.name,
          issuer: card.issuer || null,
          annualFee: typeof card.annualFee === "number" ? card.annualFee : null,
          logoKey: card.slug,
        }
      : null,
    estimatedValue: decision.rewardEstimate
      ? {
          label: decision.rewardEstimate.label,
          amountUSD:
            typeof decision.rewardEstimate.estimatedValueUSD === "number"
              ? round(decision.rewardEstimate.estimatedValueUSD, 2)
              : null,
          effectiveRate:
            typeof decision.rewardEstimate.effectiveRate === "number"
              ? decision.rewardEstimate.effectiveRate
              : null,
        }
      : null,
    confidence: {
      label: decision.confidence?.label || "unknown",
      score:
        typeof decision.confidence?.score === "number"
          ? round(decision.confidence.score, 2)
          : null,
      userFacingLabel: userFacingConfidence(decision.confidence?.label || "unknown"),
    },
    explanation: {
      headline: headlineFor(decision),
      primaryReason:
        decision.primaryReason?.detail ||
        recommendation?.primaryReason?.detail ||
        "Rewardly found the strongest available option in your wallet.",
      supportingReasons: supportingReasonsFor(decision),
      contextualInsight: decision.contextualInsight || null,
    },
    opportunitySummary: {
      headline: opportunities.length
        ? "What to know next"
        : benefits.length
          ? "What you unlock"
          : "Value from your wallet",
      benefits: Array.from(new Set([
        ...benefits,
        ...opportunities.slice(0, 2).map((opportunity) => opportunity.title),
      ])).slice(0, 4),
      savingsCue:
        opportunities[0]?.estimatedValue.amountUSD
          ? `$${opportunities[0].estimatedValue.amountUSD.toFixed(2)} opportunity`
          : savingsCueFor(decision),
    },
    proactiveOpportunities: opportunities.slice(0, 3).map((opportunity) => ({
      opportunityId: opportunity.opportunityId,
      title: opportunity.title,
      summary: opportunity.summary,
      priority: opportunity.priority,
      estimatedValueUSD: opportunity.estimatedValue.amountUSD,
      actionRequired: opportunity.actionRequired,
    })),
    merchantSummary: {
      name: decision.merchant?.name || "Unknown merchant",
      category: decision.merchant?.category || null,
      hostname: decision.merchant?.hostname || decision.merchant?.domain || null,
    },
    walletSummary: {
      cardCount: decision.wallet?.cardSlugs?.length || 0,
      source: decision.wallet?.source || "empty",
      cardSlugs: decision.wallet?.cardSlugs || [],
      missingInformation: missingInformationFor(decision),
    },
    purchaseSummary: purchaseSummaryFor(decision),
    purchaseConfidence: purchaseContext
      ? {
          label: purchaseContext.confidenceLabel,
          score: round(purchaseContext.confidenceScore, 2),
        }
      : null,
    dominantCategory: purchaseContext?.dominantCategory || null,
    exclusionsSummary: exclusionsSummaryFor(decision),
    mixedCartWarning: purchaseContext?.materiallyMixed
      ? "This cart includes multiple meaningful categories, so Rewardly kept the recommendation merchant-based."
      : null,
    availableActions: actionsForState(state),
    generatedAt,
    performance: {
      targetMs: PRODUCT_PERFORMANCE_TARGETS,
      actualMs: actualPerformance,
      withinTargets: performanceWithinTargets(actualPerformance),
    },
  };
}

export function createLifecycleEvent(input: {
  stage: RecommendationLifecycleStage;
  presentation?: RecommendationPresentationModel | null;
  decision?: PaymentDecision | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}): RecommendationLifecycleEvent {
  const merchantName =
    input.presentation?.merchantSummary.name ||
    input.decision?.merchant?.name ||
    null;
  return {
    lifecycleId: stableId("lifecycle", [
      input.stage,
      merchantName,
      input.presentation?.presentationId,
      input.occurredAt,
    ]),
    stage: input.stage,
    merchantName,
    recommendationState:
      input.presentation?.state ||
      (input.decision ? stateForDecision(input.decision) : "loading"),
    occurredAt: input.occurredAt || new Date().toISOString(),
    metadata: input.metadata || {},
  };
}

export function createFeedbackEvent(input: {
  type: FeedbackEventType;
  userId?: string | null;
  installationId?: string | null;
  presentationId?: string | null;
  merchantName?: string | null;
  cardSlug?: string | null;
  reason?: string | null;
  createdAt?: string;
}): ProductFeedbackEvent {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    feedbackId: stableId("feedback", [
      input.type,
      input.userId,
      input.installationId,
      input.presentationId,
      createdAt,
    ]),
    type: input.type,
    userId: input.userId || null,
    installationId: input.installationId || null,
    presentationId: input.presentationId || null,
    merchantName: input.merchantName || null,
    cardSlug: input.cardSlug || null,
    reason: input.reason || null,
    createdAt,
  };
}

export function createProductAnalyticsEvent(input: {
  type: ProductAnalyticsEventType;
  userId?: string | null;
  installationId?: string | null;
  surface?: ProductAnalyticsEvent["surface"];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): ProductAnalyticsEvent {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    eventId: stableId("product-event", [
      input.type,
      input.userId,
      input.installationId,
      createdAt,
    ]),
    type: input.type,
    userId: input.userId || null,
    installationId: input.installationId || null,
    surface: input.surface || "backend",
    metadata: input.metadata || {},
    createdAt,
  };
}

export function buildDashboardExperienceModel(input: {
  userId: string;
  walletCardSlugs?: string[];
  activeBenefits?: string[];
  expiringBenefits?: string[];
  recentRecommendations?: RecommendationPresentationModel[];
  recommendationHistory?: RecommendationLifecycleEvent[];
}): DashboardExperienceModel {
  const recent = input.recentRecommendations || [];
  const estimatedValueUSD = recent.reduce(
    (sum, item) => sum + (item.estimatedValue?.amountUSD || 0),
    0,
  );
  return {
    userId: input.userId,
    currentWallet: {
      cardSlugs: input.walletCardSlugs || [],
      cardCount: input.walletCardSlugs?.length || 0,
    },
    activeBenefits: input.activeBenefits || [],
    expiringBenefits: input.expiringBenefits || [],
    recentRecommendations: recent,
    recommendationHistory: input.recommendationHistory || [],
    savingsSummary: {
      estimatedValueUSD: round(estimatedValueUSD, 2),
      recommendationCount: recent.length,
    },
    opportunitySummary: {
      headline: recent.length
        ? "Recent checkout opportunities"
        : "Add cards and shop normally to build your Rewardly history.",
      opportunities: Array.from(
        new Set(recent.flatMap((item) => item.opportunitySummary.benefits)),
      ).slice(0, 5),
    },
    mostUsedCards: mostUsedCards(recent),
  };
}

export function stateForDecision(decision: PaymentDecision): RecommendationState {
  if (!decision.wallet?.cardSlugs?.length) return "wallet_information_missing";
  if (!decision.merchant?.name) return "merchant_unknown";
  if (!decision.recommendedCard) return "no_recommendation";
  if (decision.confidence?.label === "low") return "low_confidence";
  if (
    (decision.unlockedBenefits || []).some((match) =>
      /expired/i.test(`${match.summary} ${match.benefit?.label}`),
    )
  ) {
    return "benefit_expired";
  }
  return "recommendation_ready";
}

export function isValidLifecycleTransition(
  from: RecommendationLifecycleStage,
  to: RecommendationLifecycleStage,
) {
  const order: RecommendationLifecycleStage[] = [
    "merchant_detected",
    "recommendation_requested",
    "decision_generated",
    "presentation_generated",
    "displayed_to_user",
    "user_interaction",
    "dismissed",
    "saved",
    "viewed",
    "analytics_recorded",
  ];
  return order.indexOf(to) >= order.indexOf(from);
}

function actionsForState(state: RecommendationState): PresentationAction[] {
  if (state === "recommendation_ready" || state === "low_confidence") {
    return [
      { action: "dismiss", label: "Got it", primary: true },
      { action: "view_explanation", label: "Why this card", primary: false },
      { action: "mark_incorrect", label: "Report issue", primary: false },
    ];
  }
  if (state === "wallet_information_missing") {
    return [
      { action: "open_dashboard", label: "Add cards", primary: true },
      { action: "dismiss", label: "Not now", primary: false },
    ];
  }
  return [{ action: "dismiss", label: "Close", primary: true }];
}

function summaryForDecision(decision: PaymentDecision) {
  if (!decision.recommendedCard) return decision.recommendationSummary;
  const card = decision.recommendedCard.card.name;
  const merchant = decision.merchant?.name || "checkout";
  const value = decision.rewardEstimate?.label;
  if (value) return `Use ${card} at ${merchant}. You'll get ${value}.`;
  return decision.recommendationSummary || `Use ${card} at ${merchant}.`;
}

function headlineFor(decision: PaymentDecision) {
  if (!decision.recommendedCard) return "Rewardly could not find a confident card yet.";
  if ((decision.unlockedBenefits || []).length) return "This card unlocks the best available value.";
  if (decision.rewardEstimate?.label) return "This card earns the strongest rewards here.";
  return "This is the strongest card in your wallet for this checkout.";
}

function supportingReasonsFor(decision: PaymentDecision) {
  const reasons = [
    decision.primaryReason?.detail,
    decision.rewardEstimate?.label ? `You get ${decision.rewardEstimate.label}.` : null,
    ...(decision.unlockedBenefits || []).map((match) => match.summary || match.benefit.label),
  ].filter(Boolean) as string[];
  return Array.from(new Set(reasons)).slice(0, 3);
}

function savingsCueFor(decision: PaymentDecision) {
  const amount = decision.rewardEstimate?.estimatedValueUSD;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return `Estimated value: $${round(amount, 2).toFixed(2)}`;
  }
  return decision.rewardEstimate?.label || null;
}

function missingInformationFor(decision: PaymentDecision) {
  const missing: string[] = [];
  if (!decision.wallet?.cardSlugs?.length) missing.push("wallet_cards");
  if (!decision.merchant?.name) missing.push("merchant");
  if (!decision.recommendedCard) missing.push("recommendation");
  return missing;
}

function purchaseSummaryFor(decision: PaymentDecision) {
  const context = decision.recommendationPurchaseContext;
  if (!context) return null;
  if (context.refinement === "purchase_refined" && context.dominantCategory) {
    return `Rewardly detected this as a ${categoryLabel(context.dominantCategory)} purchase.`;
  }
  if (context.refinement === "mixed_cart_fallback") {
    return "Rewardly detected purchase details, but kept the recommendation merchant-based because the cart is mixed.";
  }
  if (context.refinement === "low_confidence_fallback") {
    return "Rewardly detected purchase details, but they were not confident enough to affect the recommendation.";
  }
  return "Rewardly used the merchant match as the main recommendation signal.";
}

function exclusionsSummaryFor(decision: PaymentDecision) {
  const context = decision.recommendationPurchaseContext;
  if (!context?.exclusions.length) return null;
  const excludedAmount = context.categoryDistribution
    .filter((item) => item.normalizedCategory === "gift_card")
    .reduce((sum, item) => sum + (item.estimatedAmount || 0), 0);
  const amountText =
    excludedAmount > 0 ? `$${round(excludedAmount, 2).toFixed(2)} in ` : "";
  return `${amountText}${context.exclusions.join(", ")} items were excluded from bonus-category value when detected.`;
}

function categoryLabel(category: PurchaseCategory) {
  return category.replace(/_/g, " ");
}

function userFacingConfidence(label: PaymentDecision["confidence"]["label"]) {
  if (label === "high") return "Strong recommendation";
  if (label === "medium") return "Good recommendation";
  if (label === "low") return "Worth checking";
  return "Not enough information";
}

function performanceWithinTargets(actual: Partial<ProductPerformanceTargets>) {
  return (Object.entries(actual) as Array<[ProductPerformanceMetric, number]>).every(
    ([metric, value]) => value <= PRODUCT_PERFORMANCE_TARGETS[metric],
  );
}

function mostUsedCards(recent: RecommendationPresentationModel[]) {
  const counts = new Map<string, number>();
  for (const item of recent) {
    const slug = item.recommendedCard?.slug;
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([cardSlug, recommendationCount]) => ({ cardSlug, recommendationCount }))
    .sort((a, b) => b.recommendationCount - a.recommendationCount)
    .slice(0, 5);
}

function stableId(prefix: string, parts: Array<unknown>) {
  const seed = parts.map((part) => String(part || "")).join("|");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `${prefix}_${hash.toString(16)}`;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
