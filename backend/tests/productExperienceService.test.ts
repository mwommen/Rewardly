import {
  PRODUCT_PERFORMANCE_TARGETS,
  RECOMMENDATION_STATES,
  buildDashboardExperienceModel,
  createFeedbackEvent,
  createLifecycleEvent,
  createProductAnalyticsEvent,
  generateRecommendationPresentation,
  isValidLifecycleTransition,
  stateForDecision,
} from "../src/services/productExperienceService";
import type { PaymentDecision } from "../../packages/rewardly-core/src";

const decision = {
  recommendedCard: {
    card: {
      slug: "amex-gold",
      name: "American Express Gold Card",
      issuer: "American Express",
      annualFee: 325,
    },
    primaryReason: {
      label: "Best rewards",
      detail: "4x rewards at restaurants",
      kind: "reward",
    },
    rewardEstimate: {
      label: "4x rewards",
      effectiveRate: 4,
      estimatedValueUSD: 8,
    },
    confidence: {
      score: 0.91,
      label: "high",
    },
    unlockedBenefits: [
      {
        benefit: { label: "Dining Credit", type: "credit" },
        card: {
          slug: "amex-gold",
          name: "American Express Gold Card",
          issuer: "American Express",
        },
        summary: "Dining Credit",
        requirement: "Pay with this card.",
      },
    ],
  },
  alternativeCards: [],
  primaryReason: {
    label: "Best rewards",
    detail: "4x rewards at restaurants",
    kind: "reward",
  },
  rewardEstimate: {
    label: "4x rewards",
    effectiveRate: 4,
    estimatedValueUSD: 8,
  },
  unlockedBenefits: [
    {
      benefit: { label: "Dining Credit", type: "credit" },
      card: {
        slug: "amex-gold",
        name: "American Express Gold Card",
        issuer: "American Express",
      },
      summary: "Dining Credit",
      requirement: "Pay with this card.",
    },
  ],
  confidence: {
    score: 0.91,
    label: "high",
  },
  recommendationSummary:
    "Use American Express Gold Card because it earns the most rewards.",
  contextualInsight: "Credits can expire or require enrollment.",
  merchant: {
    name: "DoorDash",
    category: "dining",
    hostname: "www.doordash.com",
  },
  wallet: {
    userId: "devUser",
    source: "manual",
    cardSlugs: ["amex-gold"],
  },
  generatedAt: "2026-07-22T00:00:00.000Z",
} satisfies PaymentDecision;

describe("productExperienceService", () => {
  test("generates a UI-ready presentation model from a payment decision", () => {
    const presentation = generateRecommendationPresentation({
      decision,
      actualPerformanceMs: {
        merchant_detection_ms: 120,
        recommendation_generation_ms: 420,
        popup_display_ms: 850,
      },
      generatedAt: "2026-07-22T00:00:01.000Z",
    });

    expect(presentation).toEqual(
      expect.objectContaining({
        state: "recommendation_ready",
        recommendationSummary:
          "Use American Express Gold Card at DoorDash. You'll get 4x rewards.",
        recommendedCard: expect.objectContaining({
          slug: "amex-gold",
          displayName: "American Express Gold Card",
          logoKey: "amex-gold",
        }),
        estimatedValue: expect.objectContaining({
          label: "4x rewards",
          amountUSD: 8,
        }),
      }),
    );
    expect(presentation.opportunitySummary.benefits).toEqual(
      expect.arrayContaining(["Dining Credit", "Dining Credit available at checkout"]),
    );
    expect(presentation.proactiveOpportunities).toHaveLength(1);
    expect(presentation.availableActions.map((action) => action.action)).toEqual(
      expect.arrayContaining(["dismiss", "view_explanation", "mark_incorrect"]),
    );
    expect(presentation.performance.withinTargets).toBe(true);
  });

  test("surfaces purchase intelligence fields without requiring UI category logic", () => {
    const presentation = generateRecommendationPresentation({
      decision: {
        ...decision,
        recommendationPurchaseContext: {
          dominantCategory: "groceries",
          categoryDistribution: [
            { normalizedCategory: "groceries", estimatedAmount: 60, share: 0.6 },
            { normalizedCategory: "gift_card", estimatedAmount: 40, share: 0.4 },
          ],
          exclusions: ["gift_card"],
          confidenceScore: 0.88,
          confidenceLabel: "high",
          hasGiftCard: true,
          hasCashEquivalent: false,
          hasDigitalGoods: false,
          hasSubscription: false,
          total: 100,
          eligibleAmount: 60,
          materiallyMixed: true,
          mixedCartThreshold: 0.2,
          refinement: "mixed_cart_fallback",
        },
      },
    });

    expect(presentation.purchaseSummary).toMatch(/kept the recommendation merchant-based/i);
    expect(presentation.purchaseConfidence).toEqual({
      label: "high",
      score: 0.88,
    });
    expect(presentation.dominantCategory).toBe("groceries");
    expect(presentation.exclusionsSummary).toMatch(/\$40.00/);
    expect(presentation.mixedCartWarning).toMatch(/multiple meaningful categories/i);
  });

  test("recommendation states cover user-visible edge cases", () => {
    expect(RECOMMENDATION_STATES).toEqual(
      expect.arrayContaining([
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
      ]),
    );
    expect(stateForDecision(decision)).toBe("recommendation_ready");
    expect(
      stateForDecision({
        ...decision,
        wallet: { ...decision.wallet, cardSlugs: [] },
      }),
    ).toBe("wallet_information_missing");
    expect(
      stateForDecision({
        ...decision,
        recommendedCard: null,
      }),
    ).toBe("no_recommendation");
  });

  test("lifecycle transitions and events are deterministic", () => {
    const presentation = generateRecommendationPresentation({ decision });
    const event = createLifecycleEvent({
      stage: "presentation_generated",
      presentation,
      decision,
      occurredAt: "2026-07-22T00:00:02.000Z",
    });

    expect(event).toEqual(
      expect.objectContaining({
        stage: "presentation_generated",
        merchantName: "DoorDash",
        recommendationState: "recommendation_ready",
      }),
    );
    expect(
      isValidLifecycleTransition(
        "recommendation_requested",
        "presentation_generated",
      ),
    ).toBe(true);
    expect(isValidLifecycleTransition("displayed_to_user", "merchant_detected")).toBe(false);
  });

  test("feedback and analytics events are platform independent", () => {
    const feedback = createFeedbackEvent({
      type: "wrong_card",
      userId: "devUser",
      presentationId: "presentation_123",
      merchantName: "DoorDash",
      cardSlug: "amex-gold",
      reason: "Expected Chase Sapphire",
      createdAt: "2026-07-22T00:00:03.000Z",
    });
    const analytics = createProductAnalyticsEvent({
      type: "recommendation_displayed",
      installationId: "install-123",
      surface: "extension",
      metadata: { merchant: "DoorDash" },
      createdAt: "2026-07-22T00:00:03.000Z",
    });

    expect(feedback).toEqual(
      expect.objectContaining({
        type: "wrong_card",
        cardSlug: "amex-gold",
      }),
    );
    expect(analytics).toEqual(
      expect.objectContaining({
        type: "recommendation_displayed",
        surface: "extension",
      }),
    );
  });

  test("performance targets are measurable and dashboard model is future-ready", () => {
    const presentation = generateRecommendationPresentation({ decision });
    const dashboard = buildDashboardExperienceModel({
      userId: "devUser",
      walletCardSlugs: ["amex-gold"],
      activeBenefits: ["Dining Credit"],
      expiringBenefits: ["Uber Credit"],
      recentRecommendations: [presentation],
      recommendationHistory: [
        createLifecycleEvent({ stage: "displayed_to_user", presentation }),
      ],
    });

    expect(PRODUCT_PERFORMANCE_TARGETS).toEqual(
      expect.objectContaining({
        merchant_detection_ms: 200,
        recommendation_generation_ms: 500,
        presentation_generation_ms: 100,
        popup_display_ms: 1000,
      }),
    );
    expect(dashboard).toEqual(
      expect.objectContaining({
        userId: "devUser",
        currentWallet: { cardSlugs: ["amex-gold"], cardCount: 1 },
        savingsSummary: {
          estimatedValueUSD: 8,
          recommendationCount: 1,
        },
      }),
    );
    expect(dashboard.mostUsedCards).toEqual([
      { cardSlug: "amex-gold", recommendationCount: 1 },
    ]);
  });
});
