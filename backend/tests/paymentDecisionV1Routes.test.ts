jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

import router from "../src/routes/v1/paymentDecisionRoutes";
import { decidePayment } from "../src/services/paymentDecisionService";

const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

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

function mockRecommendedDecision(overrides: Record<string, unknown> = {}) {
  return {
    recommendedCard: {
      card: {
        slug: "amex-gold",
        name: "American Express Gold",
        issuer: "American Express",
      },
      primaryReason: {
        label: "4x dining",
        detail: "Earns the highest estimated reward value.",
        kind: "reward",
      },
      rewardEstimate: {
        label: "4x",
        effectiveRate: 4,
        estimatedValueUSD: 5.71,
      },
      unlockedBenefits: [],
    },
    alternativeCards: [],
    primaryReason: {
      label: "4x dining",
      detail: "Earns the highest estimated reward value.",
      kind: "reward",
    },
    unlockedBenefits: [],
    confidence: { score: 0.97, label: "high" },
    recommendationSummary: "American Express Gold is best for this purchase.",
    decisionNarrative: {
      merchant: "Amazon",
      recommendedCard: { slug: "amex-gold", name: "American Express Gold" },
      reasonType: "category_bonus",
      headline: "Use American Express Gold",
      summary: "This card earns the highest estimated reward value.",
      estimatedRewardValue: 5.71,
      confidence: "HIGH",
      primaryReason: {
        type: "category_bonus",
        headline: "Best reward value",
        summary: "Earns the highest estimated reward value.",
      },
      supportingReasons: [
        {
          type: "category_bonus",
          headline: "Category match",
          summary: "Merchant category matched an elevated reward rule.",
        },
      ],
      scoringEvidence: [],
    },
    merchant: { name: "Amazon", category: "online_retail", confidence: 0.9 },
    wallet: {
      userId: "request-scoped",
      source: "manual",
      cardSlugs: ["amex-gold", "chase-sapphire-preferred"],
    },
    generatedAt: "2026-07-29T00:00:00.000Z",
    ...overrides,
  } as any;
}

describe("paymentDecisionV1Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /payment-decisions returns a developer-friendly recommendation", async () => {
    mockedDecidePayment.mockResolvedValueOnce(mockRecommendedDecision());

    const res = await invokeRoute("POST", "/payment-decisions", {
      merchant: { name: "Amazon", category: "online_retail" },
      purchase: { amount: 142.83, currency: "USD" },
      wallet: {
        cards: [
          { cardId: "amex_gold" },
          { cardId: "chase_sapphire_preferred" },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.decisionId).toMatch(/^pdec_/);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: res.body.decisionId,
        merchant: "Amazon",
        category: "online_retail",
        amount: 142.83,
        manualCardSlugs: ["amex-gold", "chase-sapphire-preferred"],
        restrictToWallet: true,
      }),
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        status: "recommended",
        recommendedPaymentMethod: {
          cardId: "amex-gold",
          displayName: "American Express Gold",
        },
        reason: "Earns the highest estimated reward value.",
        estimatedValue: 5.71,
        currency: "USD",
        confidence: 0.97,
        explanation: expect.objectContaining({
          summary: "This card earns the highest estimated reward value.",
          factors: expect.arrayContaining([
            "Merchant category matched an elevated reward rule.",
          ]),
        }),
      }),
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        requestId: expect.stringMatching(/^req_/),
        recommendation: expect.objectContaining({
          paymentMethodId: "amex-gold",
          displayName: "American Express Gold",
          estimatedValue: 5.71,
          currency: "USD",
        }),
        decisionConfidence: expect.objectContaining({
          score: expect.any(Number),
          label: expect.any(String),
        }),
        confidenceFactors: expect.arrayContaining([
          expect.objectContaining({ name: "Merchant Resolution" }),
          expect.objectContaining({ name: "Wallet Completeness" }),
          expect.objectContaining({ name: "Rule Certainty" }),
        ]),
        evidence: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            statement: expect.any(String),
          }),
        ]),
        merchant: expect.objectContaining({
          name: "Amazon",
          category: "online_retail",
        }),
        walletSnapshot: expect.objectContaining({
          cardSlugs: ["amex-gold", "chase-sapphire-preferred"],
          evaluatedCardCount: 2,
        }),
        purchaseContext: expect.objectContaining({
          amount: 142.83,
          currency: "USD",
        }),
        ruleVersion: expect.any(String),
        merchantRegistryVersion: expect.any(String),
        benefitRegistryVersion: expect.any(String),
        knowledgeVersion: expect.any(String),
        decisionEngineVersion: expect.any(String),
        latency: expect.objectContaining({
          engineMs: expect.any(Number),
          evidenceGenerationMs: expect.any(Number),
          totalMs: expect.any(Number),
        }),
        replayAvailable: expect.any(Boolean),
      }),
    );
  });

  test("POST /payment-decisions returns deterministic decision IDs for identical requests", async () => {
    mockedDecidePayment
      .mockResolvedValueOnce(mockRecommendedDecision())
      .mockResolvedValueOnce(mockRecommendedDecision());

    const body = {
      merchant: { name: "Amazon", category: "online_retail" },
      purchase: { amount: 142.83, currency: "USD" },
      wallet: {
        cards: [
          { cardId: "amex_gold" },
          { cardId: "chase_sapphire_preferred" },
        ],
      },
    };

    const first = await invokeRoute("POST", "/payment-decisions", body);
    const second = await invokeRoute("POST", "/payment-decisions", body);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.body.decisionId).toBe(second.body.decisionId);
    expect(first.body.requestId).toBe(second.body.requestId);
  });

  test("POST /payment-decisions rejects missing purchase amount", async () => {
    const res = await invokeRoute("POST", "/payment-decisions", {
      merchant: { name: "Amazon" },
      purchase: { currency: "USD" },
      wallet: { cards: [{ cardId: "amex-gold" }] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe("purchase.amount is required");
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });

  test("POST /payment-decisions rejects duplicate normalized card IDs", async () => {
    const res = await invokeRoute("POST", "/payment-decisions", {
      merchant: { name: "Amazon" },
      purchase: { amount: 100, currency: "USD" },
      wallet: {
        cards: [{ cardId: "amex_gold" }, { cardId: "amex-gold" }],
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe(
      "wallet.cards contains duplicate cardId values",
    );
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });

  test("POST /payment-decisions supports an empty wallet without scoring outside the wallet", async () => {
    mockedDecidePayment.mockResolvedValueOnce(
      mockRecommendedDecision({
        recommendedCard: null,
        confidence: { label: "unknown" },
        recommendationSummary:
          "Add cards to your wallet to get personalized recommendations.",
        decisionNarrative: undefined,
        wallet: { userId: "request-scoped", source: "empty", cardSlugs: [] },
      }),
    );

    const res = await invokeRoute("POST", "/payment-decisions", {
      merchant: { name: "Amazon" },
      purchase: { amount: 142.83, currency: "USD" },
      wallet: { cards: [] },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        manualCardSlugs: [],
        restrictToWallet: true,
      }),
    );
    expect(res.body.status).toBe("no_recommendation");
    expect(res.body.recommendedPaymentMethod).toBeNull();
    expect(res.body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INCOMPLETE_WALLET" }),
      ]),
    );
  });

  test("POST /payment-decisions rejects unsupported purchase currency", async () => {
    const res = await invokeRoute("POST", "/payment-decisions", {
      merchant: { name: "Amazon" },
      purchase: { amount: 142.83, currency: "EUR" },
      wallet: { cards: [{ cardId: "amex-gold" }] },
    });

    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe("UNSUPPORTED_PURCHASE");
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });

  test("POST /payment-decisions returns structured error when engine fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedDecidePayment.mockRejectedValueOnce(new Error("database exploded"));

    const res = await invokeRoute("POST", "/payment-decisions", {
      merchant: { name: "Amazon" },
      purchase: { amount: 142.83, currency: "USD" },
      wallet: { cards: [{ cardId: "amex-gold" }] },
    });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: "ENGINE_FAILURE",
        message: "Rewardly could not create a payment decision.",
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/database exploded|stack/i);
    errorSpy.mockRestore();
  });

  test("GET /openapi.json returns synchronized V1 API documentation", async () => {
    const res = await invokeRoute("GET", "/openapi.json");

    expect(res.statusCode).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths["/api/v1/payment-decisions"].post).toEqual(
      expect.objectContaining({
        summary: "Create a payment decision",
      }),
    );
    expect(
      JSON.stringify(res.body.components.schemas.PaymentDecisionRequest),
    ).not.toContain("preferences");
    expect(res.body.components.schemas.ErrorResponse).toBeTruthy();
  });
});
