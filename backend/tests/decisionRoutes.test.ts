jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

jest.mock("../src/services/betaAuthService", () => ({
  authenticateBetaToken: jest.fn(),
}));

import router from "../src/routes/decisionRoutes";
import { decidePayment } from "../src/services/paymentDecisionService";
import { authenticateBetaToken } from "../src/services/betaAuthService";

const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;
const mockedAuthenticateBetaToken =
  authenticateBetaToken as jest.MockedFunction<typeof authenticateBetaToken>;

const ORIGINAL_ENV = process.env;

async function invokeRoute(
  method: string,
  url: string,
  body?: any,
  headers: Record<string, string> = {},
) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers,
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

describe("decisionRoutes", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      REWARDLY_ALLOW_DEV_OVERRIDES: "true",
    };
    jest.clearAllMocks();
    mockedAuthenticateBetaToken.mockResolvedValue({
      userId: "beta-user",
      status: "active",
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("POST /decisions/payment invokes PaymentDecisionService", async () => {
    mockedDecidePayment.mockResolvedValueOnce({
      recommendedCard: {
        card: {
          slug: "amex-platinum",
          name: "The Platinum Card® from American Express",
        },
      },
      wallet: {
        userId: "manualTestUser",
        cardSlugs: ["amex-platinum"],
      },
      merchant: { name: "Amazon" },
    } as any);

    const res = await invokeRoute("POST", "/decisions/payment", {
      userId: "manualTestUser",
      merchant: "Amazon",
      hostname: "www.amazon.com",
      manualCardSlugs: ["amex-platinum"],
      restrictToWallet: true,
    });

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "manualTestUser",
        merchant: "Amazon",
        hostname: "www.amazon.com",
        manualCardSlugs: ["amex-platinum"],
        restrictToWallet: true,
      }),
    );
    expect(res.body.decision.recommendedCard.card.slug).toBe("amex-platinum");
  });

  test("POST /decisions/payment rejects missing checkout context with 400", async () => {
    const res = await invokeRoute("POST", "/decisions/payment", {
      userId: "manualTestUser",
      manualCardSlugs: ["amex-platinum"],
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/payment decision requires/i);
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });

  test("POST /decisions/payment requires beta session outside development overrides", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      REWARDLY_ALLOW_DEV_OVERRIDES: "false",
      REWARDLY_BETA_SESSION_TOKEN: "beta-secret",
      REWARDLY_BETA_USER_ID: "beta-user",
    };
    mockedAuthenticateBetaToken.mockRejectedValueOnce(new Error("invalid"));

    const res = await invokeRoute("POST", "/decisions/payment", {
      userId: "spoofed-user",
      merchant: "Amazon",
      hostname: "www.amazon.com",
      manualCardSlugs: ["amex-platinum"],
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/beta session/i);
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });

  test("POST /decisions/payment maps valid beta token to server user and ignores wallet overrides", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      REWARDLY_ALLOW_DEV_OVERRIDES: "false",
      REWARDLY_BETA_SESSION_TOKEN: "beta-secret",
      REWARDLY_BETA_USER_ID: "beta-user",
    };
    mockedDecidePayment.mockResolvedValueOnce({
      recommendedCard: null,
      wallet: {
        userId: "beta-user",
        cardSlugs: ["amex-gold"],
      },
      merchant: { name: "Amazon" },
    } as any);

    const res = await invokeRoute(
      "POST",
      "/decisions/payment",
      {
        userId: "spoofed-user",
        merchant: "Amazon",
        hostname: "www.amazon.com",
        manualCardSlugs: ["amex-platinum"],
        restrictToWallet: false,
      },
      { authorization: "Bearer beta-secret" },
    );

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "beta-user",
        merchant: "Amazon",
        manualCardSlugs: undefined,
        restrictToWallet: true,
      }),
    );
  });

  test("POST /decisions/payment normalizes purchase context without changing scoring call shape", async () => {
    mockedDecidePayment.mockResolvedValueOnce({
      recommendedCard: null,
      unlockedBenefits: [],
      confidence: { label: "unknown" },
      recommendationSummary: "No recommendation yet.",
      wallet: {
        userId: "manualTestUser",
        source: "manual",
        cardSlugs: ["amex-gold"],
      },
      merchant: { name: "Amazon" },
      generatedAt: "2026-07-22T00:00:00.000Z",
    } as any);

    const res = await invokeRoute("POST", "/decisions/payment", {
      userId: "manualTestUser",
      merchant: "Amazon",
      hostname: "www.amazon.com",
      purchaseContext: {
        surface: "extension",
        purchase: {
          subtotal: 999,
          tax: 82.42,
          total: 1081.42,
          items: [{ name: "Apple MacBook Air laptop", price: 999 }],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseContext: expect.objectContaining({
          purchase: expect.objectContaining({
            checkoutProvider: "amazon",
            items: [
              expect.objectContaining({
                normalizedCategory: "electronics",
              }),
            ],
          }),
        }),
      }),
    );
    expect(res.body.purchase.items[0].normalizedCategory).toBe("electronics");
    expect(res.body.purchasePerformance.withinTargets).toBe(true);
  });

  test("POST /decisions/payment forwards allowlisted merchant intelligence signals", async () => {
    mockedDecidePayment.mockResolvedValueOnce({
      recommendedCard: null,
      wallet: {
        userId: "manualTestUser",
        source: "manual",
        cardSlugs: ["capital-one-venture"],
      },
      merchant: { name: "Best Buy" },
      merchantIntelligence: {
        identity: { merchantId: "best-buy", displayName: "Best Buy" },
        classification: { primaryCategory: "online_shopping" },
        confidence: { score: 0.92, band: "high" },
        context: {
          purchaseChannel: "online_direct",
          commerceModel: "direct",
          marketplace: { isMarketplace: false },
          checkoutProvider: "merchant_native",
        },
        resolutionStatus: "resolved",
        registryVersion: "test",
        trace: { warnings: [] },
      },
    } as any);

    const res = await invokeRoute("POST", "/decisions/payment", {
      hostname: "www.bestbuy.com",
      url: "https://www.bestbuy.com/checkout/r/payment?token=secret",
      merchantSignals: {
        hostname: "www.bestbuy.com",
        pageTitle: "Best Buy Checkout",
        detectedMerchantLabel: "Best Buy",
        documentTextSignals: ["payment method", "4111 1111 1111 1111"],
        checkoutProviderSignals: ["merchant native checkout"],
        checkoutStage: "payment",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantSignals: expect.objectContaining({
          hostname: "www.bestbuy.com",
          detectedMerchantLabel: "Best Buy",
          documentTextSignals: expect.arrayContaining(["payment method"]),
        }),
      }),
    );
    expect(res.body.merchant).toEqual(
      expect.objectContaining({
        merchantId: "best-buy",
        confidenceBand: "high",
        resolutionStatus: "resolved",
      }),
    );
  });
});
