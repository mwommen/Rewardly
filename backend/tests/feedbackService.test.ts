import {
  FeedbackPrivacyError,
  FeedbackService,
  createMemoryFeedbackStore,
} from "../src/services/feedbackService";

describe("FeedbackService", () => {
  test("records helpful recommendation feedback with analytics correlation fields", async () => {
    const store = createMemoryFeedbackStore();
    const service = new FeedbackService(store);

    const event = await service.record({
      type: "recommendation_helpful",
      installationId: "install-123",
      sessionId: "amazon-payment-session",
      merchantName: "Amazon",
      merchantDomain: "www.amazon.com",
      merchantCategory: "shopping",
      confidenceBand: "High Confidence",
      recommendedCardName: "Capital One Venture Rewards",
      extensionVersion: "1.0",
      createdAt: "2026-07-24T12:00:00.000Z",
    });

    expect(event).toEqual(
      expect.objectContaining({
        type: "recommendation_helpful",
        installationId: "install-123",
        sessionId: "amazon-payment-session",
        normalizedMerchantName: "Amazon",
        merchantDomain: "amazon.com",
        merchantSupported: true,
        confidenceBand: "High Confidence",
        recommendedCardName: "Capital One Venture Rewards",
        reason: null,
      }),
    );
  });

  test("requires one structured reason for negative feedback", async () => {
    const service = new FeedbackService(createMemoryFeedbackStore());

    await expect(
      service.record({
        type: "recommendation_not_helpful",
        installationId: "install-123",
        merchantName: "Amazon",
      }),
    ).rejects.toThrow(/reason/i);
  });

  test("records negative feedback with sanitized other comment", async () => {
    const store = createMemoryFeedbackStore();
    const service = new FeedbackService(store);

    const event = await service.record({
      type: "recommendation_not_helpful",
      installationId: "install-123",
      merchantName: "Target",
      reason: "other",
      comment: "The explanation did not match what I expected.",
    });

    expect(event.reason).toBe("other");
    expect(event.comment).toBe("The explanation did not match what I expected.");
  });

  test("rejects private data in feedback comments before storage", async () => {
    const store = createMemoryFeedbackStore();
    const service = new FeedbackService(store);

    await expect(
      service.record({
        type: "recommendation_not_helpful",
        installationId: "install-123",
        merchantName: "Amazon",
        reason: "other",
        comment: "My order number is 123456 and card 4111111111111111",
      }),
    ).rejects.toBeInstanceOf(FeedbackPrivacyError);
    expect(store.events).toHaveLength(0);
  });

  test("normalizes and deduplicates merchant support requests", async () => {
    const store = createMemoryFeedbackStore();
    const service = new FeedbackService(store);

    await service.record({
      type: "merchant_support_request",
      installationId: "install-1",
      merchantName: "Trader Joe's Grocery",
      merchantDomain: "www.traderjoes.com",
      createdAt: "2026-07-24T12:00:00.000Z",
    });
    await service.record({
      type: "merchant_support_request",
      installationId: "install-2",
      merchantName: "Trader Joes",
      merchantDomain: "traderjoes.com",
      createdAt: "2026-07-24T12:05:00.000Z",
    });

    await expect(service.merchants()).resolves.toEqual(
      expect.objectContaining({
        requestedMerchants: expect.arrayContaining([
          expect.objectContaining({
            merchant: "Trader Joes",
            requestCount: 2,
            domain: "traderjoes.com",
          }),
        ]),
      }),
    );
  });

  test("aggregates dashboard summary and trends", async () => {
    const service = new FeedbackService(createMemoryFeedbackStore());
    await service.record({
      type: "recommendation_helpful",
      installationId: "install-1",
      merchantName: "Amazon",
      confidenceBand: "High Confidence",
    });
    await service.record({
      type: "recommendation_not_helpful",
      installationId: "install-2",
      merchantName: "Target",
      confidenceBand: "Limited Confidence",
      reason: "wrong_card_recommended",
    });
    await service.record({
      type: "merchant_support_request",
      installationId: "install-3",
      merchantName: "Trader Joes",
    });

    await expect(service.summary()).resolves.toEqual(
      expect.objectContaining({
        totalFeedback: 3,
        helpfulRate: 0.5,
        notHelpfulRate: 0.5,
        merchantRequests: 1,
        mostCommonIssue: "wrong_card_recommended",
      }),
    );
    await expect(service.trends()).resolves.toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ reason: "wrong_card_recommended", count: 1 }),
        ]),
        confidenceVsFeedback: expect.arrayContaining([
          expect.objectContaining({ confidenceBand: "High Confidence", helpful: 1 }),
        ]),
      }),
    );
  });
});
