jest.mock("../src/db", () => ({
  getFeedbackCollection: jest.fn(),
}));

import router from "../src/routes/feedbackRoutes";
import { getFeedbackCollection } from "../src/db";

const mockedGetFeedbackCollection =
  getFeedbackCollection as jest.MockedFunction<typeof getFeedbackCollection>;

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

describe("feedbackRoutes", () => {
  const storedFeedback = [
    {
      feedbackId: "feedback-1",
      type: "recommendation_helpful",
      sessionId: "session-1",
      installationId: "install-1",
      merchantName: "Amazon",
      normalizedMerchantName: "Amazon",
      merchantDomain: "amazon.com",
      merchantCategory: "shopping",
      merchantSupported: true,
      confidenceBand: "High Confidence",
      recommendedCardName: "Capital One Venture Rewards",
      reason: null,
      comment: null,
      extensionVersion: "1.0",
      createdAt: "2026-07-24T12:00:00.000Z",
    },
    {
      feedbackId: "feedback-2",
      type: "recommendation_not_helpful",
      sessionId: "session-2",
      installationId: "install-2",
      merchantName: "Target",
      normalizedMerchantName: "Target",
      merchantDomain: "target.com",
      merchantCategory: "shopping",
      merchantSupported: true,
      confidenceBand: "Limited Confidence",
      recommendedCardName: "Amex Gold",
      reason: "wrong_card_recommended",
      comment: null,
      extensionVersion: "1.0",
      createdAt: "2026-07-24T12:05:00.000Z",
    },
    {
      feedbackId: "feedback-3",
      type: "merchant_support_request",
      sessionId: "session-3",
      installationId: "install-3",
      merchantName: "Trader Joes",
      normalizedMerchantName: "Trader Joes",
      merchantDomain: "traderjoes.com",
      merchantCategory: "grocery",
      merchantSupported: false,
      confidenceBand: null,
      recommendedCardName: null,
      reason: null,
      comment: null,
      extensionVersion: "1.0",
      createdAt: "2026-07-24T12:10:00.000Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetFeedbackCollection.mockResolvedValue({
      insertOne: jest.fn().mockResolvedValue({ insertedId: "feedback-id" }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(storedFeedback),
      }),
    } as any);
  });

  test("POST /feedback stores helpful feedback", async () => {
    const res = await invokeRoute("POST", "/feedback", {
      type: "recommendation_helpful",
      installationId: "install-123",
      sessionId: "session-123",
      merchantName: "Amazon",
      merchantDomain: "www.amazon.com",
      confidenceBand: "High Confidence",
      recommendedCardName: "Capital One Venture Rewards",
      extensionVersion: "1.0",
    });

    expect(res.statusCode).toBe(200);
    const collection = await mockedGetFeedbackCollection.mock.results[0].value;
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "recommendation_helpful",
        installationId: "install-123",
        sessionId: "session-123",
        normalizedMerchantName: "Amazon",
        merchantDomain: "amazon.com",
        confidenceBand: "High Confidence",
      }),
    );
  });

  test("POST /feedback rejects private data", async () => {
    const res = await invokeRoute("POST", "/feedback", {
      type: "recommendation_not_helpful",
      installationId: "install-123",
      merchantName: "Amazon",
      reason: "other",
      comment: "card 4111111111111111",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/privacy/i);
    const collection = await mockedGetFeedbackCollection.mock.results[0].value;
    expect(collection.insertOne).not.toHaveBeenCalled();
  });

  test("GET feedback dashboard endpoints return aggregates", async () => {
    await expect(invokeRoute("GET", "/feedback/summary")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          summary: expect.objectContaining({
            totalFeedback: 3,
            helpfulRate: 0.5,
            mostCommonIssue: "wrong_card_recommended",
          }),
        }),
      }),
    );
    await expect(invokeRoute("GET", "/feedback/merchants")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          merchants: expect.objectContaining({
            requestedMerchants: expect.arrayContaining([
              expect.objectContaining({
                merchant: "Trader Joes",
                requestCount: 1,
              }),
            ]),
          }),
        }),
      }),
    );
    await expect(invokeRoute("GET", "/feedback/trends")).resolves.toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          trends: expect.objectContaining({
            issues: expect.arrayContaining([
              expect.objectContaining({ reason: "wrong_card_recommended" }),
            ]),
          }),
        }),
      }),
    );
  });
});
