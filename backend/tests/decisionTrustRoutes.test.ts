jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

jest.mock("../src/services/productionAuthService", () => {
  class AuthError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
      public retryable = false,
      public details?: unknown,
    ) {
      super(message);
    }
  }
  return {
    AuthError,
    createRequestId: () => "req_test",
    authenticateAccessToken: jest.fn(async (authorization?: string) => {
      const token = String(authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) {
        throw new AuthError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Sign in is required.",
        );
      }
      if (token === "expired") {
        throw new AuthError(401, "SESSION_EXPIRED", "Session expired.");
      }
      if (token === "suspended") {
        throw new AuthError(
          403,
          "ACCOUNT_SUSPENDED",
          "This account is suspended.",
        );
      }
      if (token === "malformed") {
        throw new AuthError(401, "INVALID_SESSION", "Session is invalid.");
      }
      return {
        userId: token,
        authProviderUserId: `test:${token}`,
        email: `${token}@example.com`,
        requestId: "req_test",
      };
    }),
  };
});

import paymentRouter from "../src/routes/v1/paymentDecisionRoutes";
import trustRouter from "../src/routes/v1/decisionTrustRoutes";
import { decidePayment } from "../src/services/paymentDecisionService";
import { resetTrustInfrastructureForTests } from "../src/services/trustInfrastructureService";

const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

beforeEach(() => {
  resetTrustInfrastructureForTests();
  jest.clearAllMocks();
});

describe("decisionTrustRoutes", () => {
  test("successful payment decision exposes trust APIs", async () => {
    mockedDecidePayment.mockResolvedValue(mockDecision());

    const created = await invokeRoute(
      paymentRouter,
      "POST",
      "/payment-decisions",
      {
        merchant: { name: "Amazon", category: "online_retail" },
        purchase: { amount: 142.83, currency: "USD" },
        wallet: {
          cards: [{ cardId: "capital_one_venture" }, { cardId: "amex_gold" }],
        },
      },
      { authorization: "Bearer user-a" },
    );

    expect(created.statusCode).toBe(200);
    expect(created.body.trust).toEqual(
      expect.objectContaining({
        trustRecordId: expect.stringMatching(/^trst_/),
        status: "complete",
        replayable: true,
      }),
    );

    const decisionId = created.body.decisionId;
    const trust = await invokeRoute(
      trustRouter,
      "GET",
      `/decisions/${decisionId}/trust`,
      undefined,
      { authorization: "Bearer user-a" },
    );
    const explanation = await invokeRoute(
      trustRouter,
      "GET",
      `/decisions/${decisionId}/explanation`,
      undefined,
      { authorization: "Bearer user-a" },
    );
    const evidence = await invokeRoute(
      trustRouter,
      "GET",
      `/decisions/${decisionId}/evidence`,
      undefined,
      { authorization: "Bearer user-a" },
    );
    const alternatives = await invokeRoute(
      trustRouter,
      "GET",
      `/decisions/${decisionId}/alternatives`,
      undefined,
      { authorization: "Bearer user-a" },
    );
    const replay = await invokeRoute(
      trustRouter,
      "POST",
      `/decisions/${decisionId}/replay`,
      undefined,
      { authorization: "Bearer user-a" },
    );

    expect(trust.statusCode).toBe(200);
    expect(trust.body.trust.provenance.commercialBiasApplied).toBe(false);
    expect(explanation.body.explanation.primaryReason.code).toBe(
      "BASE_REWARD_RULE_WON",
    );
    expect(evidence.body.evidence.length).toBeGreaterThan(0);
    expect(alternatives.body.alternatives[0].paymentMethodId).toBe("amex-gold");
    expect(replay.body.replay.status).toBe("matched");
  });

  test("missing authentication is rejected", async () => {
    const res = await invokeRoute(
      trustRouter,
      "GET",
      "/decisions/pdec_missing/trust",
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  test("malformed, expired, and suspended sessions are rejected", async () => {
    const malformed = await invokeRoute(
      trustRouter,
      "GET",
      "/decisions/pdec_missing/trust",
      undefined,
      { authorization: "Bearer malformed" },
    );
    const expired = await invokeRoute(
      trustRouter,
      "GET",
      "/decisions/pdec_missing/trust",
      undefined,
      { authorization: "Bearer expired" },
    );
    const suspended = await invokeRoute(
      trustRouter,
      "GET",
      "/decisions/pdec_missing/trust",
      undefined,
      { authorization: "Bearer suspended" },
    );

    expect(malformed.statusCode).toBe(401);
    expect(malformed.body.error.code).toBe("INVALID_SESSION");
    expect(expired.statusCode).toBe(401);
    expect(expired.body.error.code).toBe("SESSION_EXPIRED");
    expect(suspended.statusCode).toBe(403);
    expect(suspended.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  test("other users cannot read trust records they do not own", async () => {
    mockedDecidePayment.mockResolvedValue(mockDecision());
    const created = await invokeRoute(
      paymentRouter,
      "POST",
      "/payment-decisions",
      {
        merchant: { name: "Amazon", category: "online_retail" },
        purchase: { amount: 142.83, currency: "USD" },
        wallet: {
          cards: [{ cardId: "capital_one_venture" }],
        },
      },
      { authorization: "Bearer user-a" },
    );

    const res = await invokeRoute(
      trustRouter,
      "GET",
      `/decisions/${created.body.decisionId}/trust`,
      undefined,
      { authorization: "Bearer user-b" },
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("DECISION_NOT_FOUND");
  });

  test("replay has a dedicated rate limit", async () => {
    mockedDecidePayment.mockResolvedValue(mockDecision());
    const created = await invokeRoute(
      paymentRouter,
      "POST",
      "/payment-decisions",
      {
        merchant: { name: "Amazon", category: "online_retail" },
        purchase: { amount: 142.83, currency: "USD" },
        wallet: {
          cards: [{ cardId: "capital_one_venture" }],
        },
      },
      { authorization: "Bearer replay-user" },
    );

    let lastResponse: any = null;
    for (let index = 0; index < 11; index += 1) {
      lastResponse = await invokeRoute(
        trustRouter,
        "POST",
        `/decisions/${created.body.decisionId}/replay`,
        undefined,
        { authorization: "Bearer replay-user" },
      );
    }

    expect(lastResponse.statusCode).toBe(429);
    expect(lastResponse.body.error.code).toBe("REPLAY_RATE_LIMITED");
  });

  test("unknown decision returns stable not-found error", async () => {
    const res = await invokeRoute(
      trustRouter,
      "GET",
      "/decisions/pdec_missing/trust",
      undefined,
      { authorization: "Bearer user-a" },
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toEqual(
      expect.objectContaining({
        code: "DECISION_NOT_FOUND",
        message: "Decision trust record was not found.",
      }),
    );
  });
});

async function invokeRoute(
  router: any,
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>,
) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: headers || {},
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
    setHeader: jest.fn(),
  };

  await new Promise<void>((resolve, reject) => {
    router.handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

function mockDecision() {
  return {
    recommendedCard: {
      card: {
        slug: "capital-one-venture",
        name: "Capital One Venture Rewards",
        issuer: "Capital One",
      },
      rewardEstimate: {
        label: "Earn 2x Venture Miles on eligible purchases.",
        estimatedValueUSD: 2.86,
      },
    },
    alternativeCards: [
      {
        card: { slug: "amex-gold", name: "American Express Gold" },
        rewardEstimate: { estimatedValueUSD: 1.43 },
        confidence: { score: 0.82 },
      },
    ],
    merchant: {
      name: "Amazon",
      category: "online_retail",
      confidence: 0.92,
    },
    primaryReason: {
      detail: "Highest verified earning rate among eligible wallet cards.",
    },
    winningReason: {
      type: "base_earning",
      explanation: "Earn 2x Venture Miles on this purchase.",
      estimatedValue: 2.86,
    },
    confidence: { score: 0.91, label: "high" },
    recommendationSummary: "Capital One Venture Rewards has the best value.",
    decisionNarrative: {
      reasonType: "base_earning",
      headline: "Use Capital One Venture Rewards",
      summary: "Earn 2x Venture Miles on this purchase.",
      primaryReason: {
        summary: "Earn 2x Venture Miles on this purchase.",
      },
      supportingReasons: [
        { summary: "Highest verified earning rate among wallet cards." },
      ],
    },
    generatedAt: "2026-08-05T12:00:00.000Z",
  } as any;
}
