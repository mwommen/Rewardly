jest.mock("../src/db", () => ({
  connectDB: jest.fn(),
  getDb: jest.fn(async () => ({ command: jest.fn(async () => ({ ok: 1 })) })),
  getCardsCollection: jest.fn(async () => ({ find: jest.fn() })),
  getLinkedAccountsCollection: jest.fn(async () => ({ find: jest.fn() })),
  getUserBenefitStatesCollection: jest.fn(async () => ({ find: jest.fn() })),
  getAnalyticsCollection: jest.fn(async () => ({ insertOne: jest.fn() })),
  getFeedbackCollection: jest.fn(async () => ({ insertOne: jest.fn() })),
  getBetaUsersCollection: jest.fn(async () => ({ findOne: jest.fn() })),
  getBetaWalletsCollection: jest.fn(async () => ({ findOne: jest.fn() })),
  getBetaExtensionConnectionsCollection: jest.fn(async () => ({
    findOne: jest.fn(),
  })),
  getDecisionRuntimeCollection: jest.fn(async () => ({
    updateOne: jest.fn(),
    findOne: jest.fn(),
  })),
  getDecisionValidationsCollection: jest.fn(async () => ({
    updateOne: jest.fn(),
    findOne: jest.fn(),
  })),
}));

jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

jest.mock("../src/routes/scrapeRoutes", () => {
  const express = require("express");
  return { __esModule: true, default: express.Router() };
});

import http from "http";
import type { AddressInfo } from "net";
import app from "../src/app";
import { decidePayment } from "../src/services/paymentDecisionService";

const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

let server: http.Server;
let baseUrl: string;

beforeAll((done) => {
  process.env.REWARDLY_DISABLE_REQUEST_ANALYTICS = "true";
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("V1 payment decision API through Express app", () => {
  test("GET /health returns monitoring response without starting server.ts", async () => {
    const res = await request("GET", "/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("POST /api/v1/payment-decisions returns a stable public recommendation response", async () => {
    mockedDecidePayment.mockResolvedValueOnce(mockRecommendedDecision());

    const res = await request("POST", "/api/v1/payment-decisions", {
      merchant: { name: "Amazon", category: "online_retail" },
      purchase: { amount: 142.83, currency: "USD" },
      wallet: {
        cards: [{ cardId: "capital_one_venture" }, { cardId: "amex_gold" }],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        decisionId: expect.stringMatching(/^pdec_/),
        status: "recommended",
        recommendedPaymentMethod: {
          cardId: "capital-one-venture",
          displayName: "Capital One Venture Rewards",
        },
        reason: "Earn 2x Venture Miles on this purchase.",
        estimatedValue: 2.86,
        currency: "USD",
        confidence: 0.94,
        explanation: expect.objectContaining({
          summary:
            "Capital One Venture Rewards has the highest verified value.",
          factors: expect.arrayContaining([
            "Earns 2x Venture Miles on eligible purchases.",
          ]),
        }),
      }),
    );
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: res.body.decisionId,
        merchant: "Amazon",
        category: "online_retail",
        amount: 142.83,
        manualCardSlugs: ["capital-one-venture", "amex-gold"],
        restrictToWallet: true,
      }),
    );
  });

  test("successful calls get deterministic runtime decision IDs", async () => {
    mockedDecidePayment
      .mockResolvedValueOnce(mockRecommendedDecision())
      .mockResolvedValueOnce(mockRecommendedDecision());

    const first = await validDecisionRequest();
    const second = await validDecisionRequest();

    expect(first.body.decisionId).toMatch(/^pdec_/);
    expect(second.body.decisionId).toMatch(/^pdec_/);
    expect(first.body.decisionId).toBe(second.body.decisionId);
    expect(first.body.requestId).toBe(second.body.requestId);
    expect(mockedDecidePayment.mock.calls[0][0].userId).toBe(
      first.body.decisionId,
    );
    expect(mockedDecidePayment.mock.calls[1][0].userId).toBe(
      second.body.decisionId,
    );
  });

  test("empty wallet is valid and remains wallet-restricted", async () => {
    mockedDecidePayment.mockResolvedValueOnce(
      mockRecommendedDecision({
        recommendedCard: null,
        confidence: { score: 0, label: "unknown" },
        recommendationSummary:
          "Add cards to your wallet to get personalized recommendations.",
        decisionNarrative: undefined,
      }),
    );

    const res = await request("POST", "/api/v1/payment-decisions", {
      merchant: { name: "Amazon" },
      purchase: { amount: 12.34, currency: "USD" },
      wallet: { cards: [] },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("no_recommendation");
    expect(res.body.recommendedPaymentMethod).toBeNull();
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        manualCardSlugs: [],
        restrictToWallet: true,
      }),
    );
  });

  test.each([
    [
      "missing merchant name",
      {
        merchant: {},
        purchase: { amount: 10, currency: "USD" },
        wallet: { cards: [] },
      },
    ],
    [
      "missing purchase amount",
      {
        merchant: { name: "Amazon" },
        purchase: { currency: "USD" },
        wallet: { cards: [] },
      },
    ],
    [
      "zero purchase amount",
      {
        merchant: { name: "Amazon" },
        purchase: { amount: 0, currency: "USD" },
        wallet: { cards: [] },
      },
    ],
    [
      "missing currency",
      {
        merchant: { name: "Amazon" },
        purchase: { amount: 10 },
        wallet: { cards: [] },
      },
    ],
    [
      "malformed wallet",
      {
        merchant: { name: "Amazon" },
        purchase: { amount: 10, currency: "USD" },
        wallet: [],
      },
    ],
    [
      "duplicate cards",
      {
        merchant: { name: "Amazon" },
        purchase: { amount: 10, currency: "USD" },
        wallet: { cards: [{ cardId: "amex_gold" }, { cardId: "amex-gold" }] },
      },
    ],
    [
      "unsupported preferences",
      {
        merchant: { name: "Amazon" },
        purchase: { amount: 10, currency: "USD" },
        wallet: { cards: [] },
        preferences: { maximizeRewards: true },
      },
    ],
  ])("rejects invalid request: %s", async (_caseName, payload) => {
    const res = await request("POST", "/api/v1/payment-decisions", payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_REQUEST");
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });

  test("rejects unsupported non-USD purchases with 422", async () => {
    const res = await request("POST", "/api/v1/payment-decisions", {
      merchant: { name: "Amazon" },
      purchase: { amount: 10, currency: "EUR" },
      wallet: { cards: [] },
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: "UNSUPPORTED_PURCHASE",
      message: "purchase.currency must be USD",
    });
    expect(mockedDecidePayment).not.toHaveBeenCalled();
  });

  test("malformed JSON returns a structured V1 error", async () => {
    const res = await rawRequest(
      "POST",
      "/api/v1/payment-decisions",
      "{not-json",
      "application/json",
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "INVALID_REQUEST",
      message: "Request body must be valid JSON.",
    });
  });

  test("oversized payload returns a structured V1 error", async () => {
    const res = await rawRequest(
      "POST",
      "/api/v1/payment-decisions",
      JSON.stringify({ padding: "x".repeat(300_000) }),
      "application/json",
    );

    expect(res.status).toBe(413);
    expect(res.body.error).toEqual({
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body exceeds the supported size.",
    });
  });

  test("engine failures do not expose stack traces or internal messages", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedDecidePayment.mockRejectedValueOnce(new Error("database exploded"));

    const res = await validDecisionRequest();

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: "ENGINE_FAILURE",
      message: "Rewardly could not create a payment decision.",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/database exploded|stack/i);
    errorSpy.mockRestore();
  });

  test("OpenAPI document reflects the hardened V1 contract", async () => {
    const res = await request("GET", "/api/v1/openapi.json");

    expect(res.status).toBe(200);
    const paymentDecisionRequest =
      res.body.components.schemas.PaymentDecisionRequest;
    expect(JSON.stringify(paymentDecisionRequest)).not.toContain("preferences");
    expect(paymentDecisionRequest.properties.purchase.required).toEqual([
      "amount",
      "currency",
    ]);
    expect(
      res.body.paths["/api/v1/payment-decisions"].post.responses["429"],
    ).toBeTruthy();
    expect(res.body.paths["/api/v1/card-catalog"].get).toBeTruthy();
  });

  test("GET /api/v1/card-catalog returns addable Rewardly catalog cards", async () => {
    const res = await request("GET", "/api/v1/card-catalog");

    expect(res.status).toBe(200);
    expect(res.body.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: "capital-one-venture",
          displayName: expect.stringMatching(/Venture/i),
        }),
      ]),
    );
  });
});

async function validDecisionRequest() {
  return request("POST", "/api/v1/payment-decisions", {
    merchant: { name: "Amazon" },
    purchase: { amount: 42, currency: "USD" },
    wallet: { cards: [{ cardId: "capital_one_venture" }] },
  });
}

async function request(method: string, path: string, body?: unknown) {
  return rawRequest(
    method,
    path,
    body === undefined ? undefined : JSON.stringify(body),
    body === undefined ? undefined : "application/json",
  );
}

function rawRequest(
  method: string,
  path: string,
  body?: string,
  contentType?: string,
): Promise<{ status: number; body: any; text: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...(contentType ? { "Content-Type": contentType } : {}),
          ...(body !== undefined
            ? { "Content-Length": Buffer.byteLength(body) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: any = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode || 0, body: parsed, text });
        });
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function mockRecommendedDecision(overrides: Record<string, unknown> = {}) {
  return {
    recommendedCard: {
      card: {
        slug: "capital-one-venture",
        name: "Capital One Venture Rewards",
        issuer: "Capital One",
      },
      primaryReason: {
        label: "2x Venture Miles",
        detail: "Earn 2x Venture Miles on this purchase.",
        kind: "reward",
      },
      rewardEstimate: {
        label: "2x",
        effectiveRate: 2,
        estimatedValueUSD: 2.86,
      },
      unlockedBenefits: [],
    },
    alternativeCards: [],
    primaryReason: {
      label: "2x Venture Miles",
      detail: "Earn 2x Venture Miles on this purchase.",
      kind: "reward",
    },
    unlockedBenefits: [],
    confidence: { score: 0.94, label: "high" },
    recommendationSummary:
      "Capital One Venture Rewards has the highest verified value.",
    decisionNarrative: {
      merchant: "Amazon",
      recommendedCard: {
        slug: "capital-one-venture",
        name: "Capital One Venture Rewards",
      },
      reasonType: "base_earn",
      headline: "Use Capital One Venture Rewards",
      summary: "Capital One Venture Rewards has the highest verified value.",
      estimatedRewardValue: 2.86,
      confidence: "HIGH",
      primaryReason: {
        type: "base_earn",
        headline: "2x Venture Miles",
        summary: "Earn 2x Venture Miles on this purchase.",
      },
      supportingReasons: [
        {
          type: "base_earn",
          headline: "Base rewards",
          summary: "Earns 2x Venture Miles on eligible purchases.",
        },
      ],
      scoringEvidence: [],
    },
    merchant: { name: "Amazon", category: "online_retail", confidence: 0.9 },
    wallet: {
      userId: "request-scoped",
      source: "manual",
      cardSlugs: ["capital-one-venture"],
    },
    generatedAt: "2026-07-29T00:00:00.000Z",
    ...overrides,
  } as any;
}
