import {
  AnalyticsPrivacyError,
  RecommendationAnalyticsService,
  createMemoryRecommendationAnalyticsStore,
} from "../src/services/recommendationAnalyticsService";

describe("RecommendationAnalyticsService", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  test("validates and stores typed recommendation analytics events", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
    });

    const event = await service.record({
      installationId: "install-123",
      source: "chrome_extension",
      event: "recommendation_displayed",
      metadata: {
        sessionId: "session-123",
        merchant: "Amazon",
        category: "online_shopping",
        stage: "payment",
        confidenceLabel: "High Confidence",
        recommendationLatencyMs: 241,
        popupLatencyMs: 19,
        estimatedRewardValueUSD: 6.2,
        advantageOverRunnerUpUSD: 2.15,
        rewardType: "miles",
        extensionVersion: "1.0.0",
        recommendationEngineVersion: "wallet-decision-engine-v1",
        merchantRegistryVersion: "merchant-registry-v1",
        browserFamily: "Chrome",
        operatingSystem: "macOS",
        hasRecommendation: true,
        walletCardCount: 3,
        ignored: "not stored",
      },
    });

    expect(event).toEqual(
      expect.objectContaining({
        sessionId: "session-123",
        eventType: "recommendation_generated",
        merchantName: "Amazon",
        merchantCategory: "online_shopping",
        checkoutStage: "payment",
        confidenceBand: "High Confidence",
        recommendationLatencyMs: 241,
        popupLatencyMs: 19,
        estimatedRewardValueUSD: 6.2,
        advantageOverRunnerUpUSD: 2.15,
        rewardType: "miles",
        extensionVersion: "1.0.0",
        recommendationEngineVersion: "wallet-decision-engine-v1",
        merchantRegistryVersion: "merchant-registry-v1",
        browserFamily: "Chrome",
        operatingSystem: "macOS",
        hasRecommendation: true,
        walletCardCount: 3,
      }),
    );
    expect(store.events).toHaveLength(1);
    expect(JSON.stringify(store.events[0])).not.toMatch(/not stored/);
  });

  test("rejects synthetic sensitive analytics metadata before storage", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
    });

    await expect(
      service.record({
        installationId: "install-123",
        source: "chrome_extension",
        event: "recommendation_failed",
        metadata: {
          merchant: "Amazon",
          errorType: "john@example.com",
        },
      }),
    ).rejects.toBeInstanceOf(AnalyticsPrivacyError);
    expect(store.events).toHaveLength(0);
  });

  test("rejects full URLs with sensitive query parameters", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
    });

    await expect(
      service.record({
        installationId: "install-123",
        source: "chrome_extension",
        event: "recommendation_failed",
        metadata: {
          merchant: "https://example.com/checkout?orderId=abc123",
        },
      }),
    ).rejects.toBeInstanceOf(AnalyticsPrivacyError);
    expect(store.events).toHaveLength(0);
  });

  test("aggregates funnel, merchant, confidence, error, and summary metrics", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
    });
    for (const event of [
      "checkout_detected",
      "merchant_detected",
      "recommendation_requested",
      "recommendation_displayed",
      "popup_visible",
      "details_opened",
      "recommendation_dismissed",
    ]) {
      await service.record({
        installationId: "install-123",
        source: "chrome_extension",
        event,
        metadata: {
          sessionId: "session-123",
          merchant: "Amazon",
          category: "online_shopping",
          confidenceLabel: "Excellent Match",
          recommendationLatencyMs: 200,
          popupLatencyMs: 20,
          estimatedRewardValueUSD: 4,
          advantageOverRunnerUpUSD: 1,
          rewardType: "points",
          popupVisible: true,
        },
      });
    }
    await service.record({
      installationId: "install-456",
      source: "chrome_extension",
      event: "recommendation_timeout",
      metadata: {
        sessionId: "session-456",
        merchant: "Unknown merchant",
        errorType: "decision_request_failed",
        errorCode: "REWARDLY_TIMEOUT",
      },
    });

    await expect(service.summary()).resolves.toEqual(
      expect.objectContaining({
        activeBetaUsers: 2,
        recommendationsToday: 1,
        recommendationsThisWeek: 1,
        recommendationSuccessRate: 1,
        popupDisplayRate: 1,
        popupDismissalRate: 1,
        detailsOpenRate: 1,
      }),
    );
    await expect(service.funnel()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "checkout_detected", count: 1 }),
        expect.objectContaining({ eventType: "popup_displayed", count: 1 }),
      ]),
    );
    await expect(service.merchants()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          merchantName: "Amazon",
          recommendationsGenerated: 1,
          popupSuccessRate: 1,
        }),
      ]),
    );
    await expect(service.confidence()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confidenceBand: "Excellent Match",
          count: 1,
          share: 1,
        }),
      ]),
    );
    await expect(service.errors()).resolves.toEqual(
      expect.objectContaining({
        total: 1,
        apiFailures: 1,
      }),
    );
  });

  test("aggregates recommendation value and merchant health metrics", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
    });

    await service.record({
      installationId: "install-123",
      event: "recommendation_requested",
      metadata: { sessionId: "s1", merchant: "Apple" },
    });
    await service.record({
      installationId: "install-123",
      event: "recommendation_generated",
      metadata: {
        sessionId: "s1",
        merchant: "Apple",
        confidenceLabel: "Excellent Match",
        recommendationLatencyMs: 200,
        estimatedRewardValueUSD: 6,
        advantageOverRunnerUpUSD: 2,
        rewardType: "miles",
      },
    });
    await service.record({
      installationId: "install-456",
      event: "recommendation_generated",
      metadata: {
        sessionId: "s2",
        merchant: "Apple",
        confidenceLabel: "Good Match",
        recommendationLatencyMs: 400,
        estimatedRewardValueUSD: 2,
        advantageOverRunnerUpUSD: 0,
        rewardType: "cash_back",
      },
    });

    await expect(service.recommendationValue()).resolves.toEqual(
      expect.objectContaining({
        recommendationCount: 2,
        averageEstimatedRewardsDisplayedUSD: 4,
        averageAdvantageOverSecondBestUSD: 1,
        valueDistribution: expect.arrayContaining([
          expect.objectContaining({ bucket: "$1-$5", count: 1 }),
          expect.objectContaining({ bucket: "$5-$10", count: 1 }),
        ]),
      }),
    );
    await expect(service.merchants()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          merchantName: "Apple",
          healthScore: expect.any(Number),
          recommendationSuccessRate: 1,
          averageRecommendationLatencyMs: 300,
        }),
      ]),
    );
  });

  test("measures time to first recommendation from install event", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
    });

    await service.record({
      installationId: "install-123",
      event: "extension_installed",
      timestamp: "2026-07-24T12:00:00.000Z",
    });
    await service.record({
      installationId: "install-123",
      event: "recommendation_generated",
      metadata: { merchant: "Amazon" },
      timestamp: "2026-07-24T12:02:30.000Z",
    });

    await expect(service.summary()).resolves.toEqual(
      expect.objectContaining({
        timeToFirstRecommendationMs: 150000,
      }),
    );
  });

  test("tracks analytics health metrics for accepted and rejected events", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
    });

    await service.record({
      installationId: "install-123",
      event: "popup_visible",
      metadata: { merchant: "Amazon" },
    });
    await expect(
      service.record({
        installationId: "install-123",
        event: "popup_visible",
        metadata: { merchant: "jane@example.com" },
      }),
    ).rejects.toBeInstanceOf(AnalyticsPrivacyError);

    await expect(service.healthStatus()).resolves.toEqual(
      expect.objectContaining({
        eventsReceived: 1,
        eventsRejected: 1,
        privacyValidationFailures: 1,
        storedEventCountSample: 1,
      }),
    );
  });

  test("cleans up expired events based on configurable retention", async () => {
    const store = createMemoryRecommendationAnalyticsStore();
    const service = new RecommendationAnalyticsService(store, {
      now: () => now,
      retentionDays: 1,
    });
    await service.record({
      installationId: "install-123",
      event: "popup_visible",
      metadata: { merchant: "Amazon" },
      timestamp: "2026-07-20T00:00:00.000Z",
    });
    await service.record({
      installationId: "install-123",
      event: "popup_visible",
      metadata: { merchant: "Target" },
      timestamp: "2026-07-24T11:00:00.000Z",
    });

    await expect(service.cleanupExpired(now)).resolves.toBe(1);
    expect(store.events.map((event) => event.merchantName)).toEqual(["Target"]);
  });
});
