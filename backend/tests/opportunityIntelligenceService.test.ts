import {
  buildOpportunityReport,
  createOpportunityAnalyticsEvent,
  detectOpportunities,
  generateOpportunityInsights,
  generateOpportunityTimeline,
  opportunityFixtureStates,
  prioritizeOpportunities,
  simulateOpportunity,
  suppressDuplicateOpportunities,
} from "../src/services/opportunityIntelligenceService";
import { generateRecommendationPresentation } from "../src/services/productExperienceService";

describe("opportunityIntelligenceService", () => {
  test("detects unused credits, expiring benefits, spend thresholds, and lounge access", () => {
    const walletBenefitStates = opportunityFixtureStates("user-1");
    const opportunities = detectOpportunities({
      userId: "user-1",
      walletBenefitStates,
      now: "2026-07-22T00:00:00.000Z",
    });

    expect(opportunities.map((item) => item.opportunityType)).toEqual(
      expect.arrayContaining([
        "dining_credit_remaining",
        "travel_credit_remaining",
        "quarterly_category_ending",
        "spend_threshold_progress",
        "unused_lounge_access",
        "benefit_expiring_soon",
      ]),
    );
    expect(opportunities[0]).toEqual(
      expect.objectContaining({
        userId: "user-1",
        status: "active",
        supportingEvidence: expect.any(Array),
      }),
    );
  });

  test("prioritizes by value, urgency, confidence, and historical behavior", () => {
    const opportunities = detectOpportunities({
      userId: "user-1",
      walletBenefitStates: opportunityFixtureStates("user-1"),
      now: "2026-07-22T00:00:00.000Z",
    });
    const prioritized = prioritizeOpportunities(opportunities, {
      dismissedOpportunityTypes: ["unused_lounge_access"],
    });

    expect(prioritized[0].estimatedValue.amountUSD).toBeGreaterThanOrEqual(50);
    expect(
      prioritized.find((item) => item.opportunityType === "unused_lounge_access")
        ?.priority,
    ).not.toBe("critical");
  });

  test("suppresses duplicate opportunities and frequent repeats", () => {
    const opportunities = detectOpportunities({
      userId: "user-1",
      walletBenefitStates: opportunityFixtureStates("user-1"),
      now: "2026-07-22T00:00:00.000Z",
    });
    const duplicated = [opportunities[0], opportunities[0], ...opportunities.slice(1)];
    const suppressed = suppressDuplicateOpportunities(duplicated, {
      recommendationFrequency: {
        [opportunities[0].opportunityId]: 4,
      },
    });

    expect(suppressed.filter((item) => item.opportunityId === opportunities[0].opportunityId)).toHaveLength(0);
    expect(new Set(suppressed.map((item) => item.opportunityId)).size).toBe(suppressed.length);
  });

  test("generates chronological timeline for resets and expirations", () => {
    const states = opportunityFixtureStates("user-1");
    const opportunities = detectOpportunities({
      userId: "user-1",
      walletBenefitStates: states,
      now: "2026-07-22T00:00:00.000Z",
    });
    const timeline = generateOpportunityTimeline(opportunities, states);

    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.map((item) => item.date)).toEqual(
      [...timeline.map((item) => item.date)].sort(),
    );
    expect(timeline.map((item) => item.eventType)).toEqual(
      expect.arrayContaining([
        "monthly_reset",
        "annual_renewal",
        "quarterly_category_change",
        "benefit_expiration",
      ]),
    );
  });

  test("simulates deterministic action and inaction impact", () => {
    const opportunity = detectOpportunities({
      userId: "user-1",
      walletBenefitStates: opportunityFixtureStates("user-1"),
      now: "2026-07-22T00:00:00.000Z",
    })[0];
    const first = simulateOpportunity(opportunity);
    const second = simulateOpportunity(opportunity);

    expect(first).toEqual(second);
    expect(first.ifCompleted.estimatedValueGainedUSD).toBe(
      opportunity.estimatedValue.ifCompletedUSD,
    );
    expect(first.ifIgnored.estimatedValueLostUSD).toBe(
      opportunity.estimatedValue.ifIgnoredUSD,
    );
  });

  test("generates insights and analytics for opportunity effectiveness", () => {
    const report = buildOpportunityReport({
      userId: "user-1",
      walletBenefitStates: opportunityFixtureStates("user-1"),
      now: "2026-07-22T00:00:00.000Z",
    });
    const analytics = createOpportunityAnalyticsEvent({
      eventType: "opportunity_completed",
      userId: "user-1",
      opportunityId: report.opportunities[0].opportunityId,
      amountUSD: report.opportunities[0].estimatedValue.amountUSD,
      createdAt: "2026-07-22T00:00:00.000Z",
    });

    expect(generateOpportunityInsights(report.opportunities).map((item) => item.insightType)).toEqual(
      expect.arrayContaining([
        "highest_value_opportunity",
        "most_urgent_opportunity",
        "potential_value_remaining",
      ]),
    );
    expect(report.analytics.map((item) => item.eventType)).toContain("opportunity_created");
    expect(analytics).toEqual(
      expect.objectContaining({
        eventType: "opportunity_completed",
        amountUSD: expect.any(Number),
      }),
    );
  });

  test("recommendation presentation includes opportunity context without changing recommendation", () => {
    const decision = {
      recommendedCard: {
        card: { slug: "amex-gold", name: "American Express Gold Card" },
        primaryReason: {
          label: "Best rewards",
          detail: "4x rewards at restaurants",
          kind: "reward",
        },
        unlockedBenefits: [],
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
      unlockedBenefits: [],
      confidence: { label: "high", score: 0.9 },
      recommendationSummary: "Use Amex Gold.",
      merchant: { name: "DoorDash", category: "dining" },
      wallet: {
        userId: "user-1",
        source: "manual",
        cardSlugs: ["amex-gold"],
      },
      generatedAt: "2026-07-22T00:00:00.000Z",
    } as any;
    const presentation = generateRecommendationPresentation({
      decision,
      opportunityContext: {
        userId: "user-1",
        walletBenefitStates: opportunityFixtureStates("user-1"),
        now: "2026-07-22T00:00:00.000Z",
      },
    });

    expect(presentation.recommendedCard?.slug).toBe("amex-gold");
    expect(presentation.proactiveOpportunities.length).toBeGreaterThan(0);
    expect(presentation.opportunitySummary.headline).toBe("What to know next");
  });
});
