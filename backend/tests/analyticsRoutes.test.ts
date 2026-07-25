jest.mock("../src/db", () => ({
  getAnalyticsCollection: jest.fn(),
}));

import router from "../src/routes/analyticsRoutes";
import { getAnalyticsCollection } from "../src/db";

const mockedGetAnalyticsCollection =
  getAnalyticsCollection as jest.MockedFunction<typeof getAnalyticsCollection>;

async function invokeRoute(method: string, url: string, body?: any) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: {},
    query: Object.fromEntries(parsed.searchParams.entries()),
    body: body || {},
    params: {},
  };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  await new Promise<void>((resolve, reject) => {
    (router as any).handle(req, res, (err: unknown) =>
      err ? reject(err) : resolve(),
    );
    setImmediate(resolve);
  });

  return res;
}

describe("analyticsRoutes", () => {
  const storedEvents = [
    {
      eventId: "event-1",
      sessionId: "session-1",
      installationId: "install-123",
      userId: null,
      source: "chrome_extension",
      timestamp: "2026-07-24T12:00:00.000Z",
      expiresAt: "2026-08-23T12:00:00.000Z",
      eventType: "recommendation_generated",
      merchantName: "Amazon",
      merchantCategory: "online_shopping",
      checkoutStage: "payment",
      confidenceBand: "High Confidence",
      recommendationLatencyMs: 220,
      popupLatencyMs: 18,
      merchantClassificationLatencyMs: 12,
      estimatedRewardValueUSD: 4.4,
      advantageOverRunnerUpUSD: 1.1,
      rewardType: "miles",
      extensionVersion: "1.0",
      recommendationEngineVersion: "wallet-decision-engine-v1",
      merchantRegistryVersion: "merchant-registry-v1",
      browserFamily: "Chrome",
      operatingSystem: "macOS",
      analyticsProcessingMs: 1,
      errorType: null,
      errorCode: null,
      hasRecommendation: true,
      popupVisible: true,
      walletCardCount: 3,
    },
    {
      eventId: "event-2",
      sessionId: "session-1",
      installationId: "install-123",
      userId: null,
      source: "chrome_extension",
      timestamp: "2026-07-24T12:00:02.000Z",
      expiresAt: "2026-08-23T12:00:02.000Z",
      eventType: "popup_displayed",
      merchantName: "Amazon",
      merchantCategory: "online_shopping",
      checkoutStage: "payment",
      confidenceBand: "High Confidence",
      recommendationLatencyMs: 220,
      popupLatencyMs: 18,
      merchantClassificationLatencyMs: 12,
      estimatedRewardValueUSD: null,
      advantageOverRunnerUpUSD: null,
      rewardType: null,
      extensionVersion: "1.0",
      recommendationEngineVersion: "wallet-decision-engine-v1",
      merchantRegistryVersion: "merchant-registry-v1",
      browserFamily: "Chrome",
      operatingSystem: "macOS",
      analyticsProcessingMs: 1,
      errorType: null,
      errorCode: null,
      hasRecommendation: true,
      popupVisible: true,
      walletCardCount: 3,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAnalyticsCollection.mockResolvedValue({
      insertOne: jest.fn().mockResolvedValue({ insertedId: "event-id" }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(storedEvents),
      }),
    } as any);
  });

  test("POST /event accepts anonymous extension installation events", async () => {
    const res = await invokeRoute("POST", "/event", {
      installationId: "install-123",
      source: "chrome_extension",
      event: "recommendation_displayed",
      metadata: {
        sessionId: "session-123",
        merchant: "Amazon",
        stage: "payment",
        confidenceLabel: "High Confidence",
        estimatedRewardValueUSD: 4.4,
        advantageOverRunnerUpUSD: 1.1,
        rewardType: "miles",
        extensionVersion: "1.0",
        recommendationEngineVersion: "wallet-decision-engine-v1",
        merchantRegistryVersion: "merchant-registry-v1",
        browserFamily: "Chrome",
        operatingSystem: "macOS",
      },
    });

    expect(res.statusCode).toBe(200);
    const collection = await mockedGetAnalyticsCollection.mock.results[0].value;
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        installationId: "install-123",
        source: "chrome_extension",
        eventType: "recommendation_generated",
        sessionId: "session-123",
        merchantName: "Amazon",
        checkoutStage: "payment",
        confidenceBand: "High Confidence",
        estimatedRewardValueUSD: 4.4,
        advantageOverRunnerUpUSD: 1.1,
        rewardType: "miles",
        extensionVersion: "1.0",
        browserFamily: "Chrome",
        operatingSystem: "macOS",
      }),
    );
  });

  test("POST /event rejects events without user or installation identity", async () => {
    const res = await invokeRoute("POST", "/event", {
      event: "recommendation_displayed",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/installation id/i);
    const collection = await mockedGetAnalyticsCollection.mock.results[0].value;
    expect(collection.insertOne).not.toHaveBeenCalled();
  });

  test("POST /event rejects sensitive metadata", async () => {
    const res = await invokeRoute("POST", "/event", {
      installationId: "install-123",
      event: "recommendation_failed",
      metadata: {
        merchant: "Amazon",
        errorType: "4111111111111111",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/privacy/i);
    const collection = await mockedGetAnalyticsCollection.mock.results[0].value;
    expect(collection.insertOne).not.toHaveBeenCalled();
  });

  test("GET /summary returns product dashboard overview metrics", async () => {
    const res = await invokeRoute("GET", "/summary");

    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        activeBetaUsers: 1,
        recommendationsThisWeek: 1,
        popupDisplayRate: 1,
      }),
    );
  });

  test("GET dashboard metric endpoints return merchants confidence errors and funnel", async () => {
    await expect(invokeRoute("GET", "/merchants")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          merchants: expect.arrayContaining([
            expect.objectContaining({ merchantName: "Amazon" }),
          ]),
        }),
      }),
    );
    await expect(invokeRoute("GET", "/confidence")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          confidence: expect.arrayContaining([
            expect.objectContaining({ confidenceBand: "High Confidence" }),
          ]),
        }),
      }),
    );
    await expect(invokeRoute("GET", "/errors")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          errors: expect.objectContaining({ total: 0 }),
        }),
      }),
    );
    await expect(invokeRoute("GET", "/funnel")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          funnel: expect.arrayContaining([
            expect.objectContaining({ eventType: "popup_displayed" }),
          ]),
        }),
      }),
    );
    await expect(invokeRoute("GET", "/value")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          value: expect.objectContaining({
            averageEstimatedRewardsDisplayedUSD: 4.4,
            averageAdvantageOverSecondBestUSD: 1.1,
            mostCommonRewardType: "miles",
          }),
        }),
      }),
    );
    await expect(invokeRoute("GET", "/health")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          health: expect.objectContaining({
            storedEventCountSample: 2,
          }),
        }),
      }),
    );
  });
});
