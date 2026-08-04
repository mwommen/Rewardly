jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

import intentRouter from "../src/routes/v1/financialIntentRoutes";
import paymentRouter from "../src/routes/v1/paymentDecisionRoutes";
import { decidePayment } from "../src/services/paymentDecisionService";
import { resetFinancialIntentStoreForTests } from "../src/services/financialIntentService";
import {
  addPlanItem,
  createShoppingPlan,
  resetPlanningStoreForTests,
} from "../src/services/planningService";

const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

async function invokeRoute(router: any, method: string, url: string, body?: any) {
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
    router.handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

function mockDecision(cardName = "Capital One Venture Rewards", estimatedValue = 2.86) {
  const slug = cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    recommendedCard: {
      card: { slug, name: cardName, issuer: "Capital One" },
      rewardEstimate: { estimatedValueUSD: estimatedValue },
    },
    confidence: { score: 0.94, label: "high" },
    recommendationSummary: `${cardName} has the highest verified value.`,
    primaryReason: {
      detail: "Highest verified earning rate among the eligible cards in your wallet.",
    },
    decisionNarrative: {
      summary: `${cardName} is best for this purchase.`,
      estimatedRewardValue: estimatedValue,
      estimatedReward: `About $${estimatedValue.toFixed(2)} in estimated value.`,
      comparison: "Highest verified value among wallet cards.",
      primaryReason: {
        summary: "Highest verified earning rate among the eligible cards in your wallet.",
      },
      supportingReasons: [
        { summary: "Earns 2x Venture Miles on eligible purchases." },
      ],
    },
  } as any;
}

describe("financialIntentRoutes", () => {
  beforeEach(() => {
    resetFinancialIntentStoreForTests();
    resetPlanningStoreForTests();
    jest.clearAllMocks();
  });

  test("routes SMART_PAY intent to PaymentDecisionService with unified response", async () => {
    mockedDecidePayment.mockResolvedValueOnce(mockDecision());

    const res = await invokeRoute(intentRouter, "POST", "/intents", {
      type: "SMART_PAY",
      requestId: "mobile-smart-pay-1",
      payload: {
        merchant: { name: "Amazon", category: "online_retail" },
        purchase: { amount: 142.83, currency: "USD" },
        wallet: { cards: [{ cardId: "capital_one_venture" }] },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        intentId: expect.stringMatching(/^fint_/),
        requestId: "mobile-smart-pay-1",
        intentType: "SMART_PAY",
        executedCapabilities: ["PaymentDecisionService"],
        errors: [],
        metadata: expect.objectContaining({ success: true }),
      }),
    );
    expect(res.body.result.recommendedPaymentMethod.displayName).toBe(
      "Capital One Venture Rewards",
    );
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: "Amazon",
        category: "online_retail",
        amount: 142.83,
        manualCardSlugs: ["capital-one-venture"],
        restrictToWallet: true,
      }),
    );
  });

  test("GET /intents/:id returns previous unified response", async () => {
    mockedDecidePayment.mockResolvedValueOnce(mockDecision());
    const created = await invokeRoute(intentRouter, "POST", "/intents", {
      type: "SMART_PAY",
      payload: {
        merchant: { name: "Amazon" },
        purchase: { amount: 10, currency: "USD" },
        wallet: { cards: [{ cardId: "capital-one-venture" }] },
      },
    });

    const fetched = await invokeRoute(
      intentRouter,
      "GET",
      `/intents/${created.body.intentId}`,
    );

    expect(fetched.statusCode).toBe(200);
    expect(fetched.body.intentId).toBe(created.body.intentId);
  });

  test("rejects unknown and invalid intents with structured errors", async () => {
    const unknown = await invokeRoute(intentRouter, "POST", "/intents", {
      type: "MAKE_MAGIC",
    });
    const invalid = await invokeRoute(intentRouter, "POST", "/intents", {
      type: "SMART_PAY",
      payload: {
        merchant: {},
        purchase: { amount: 10, currency: "USD" },
        wallet: { cards: [] },
      },
    });

    expect(unknown.statusCode).toBe(400);
    expect(unknown.body.error.code).toBe("UNKNOWN_INTENT");
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body.error.message).toBe("payload.merchant.name is required");
  });

  test("routes PLAN_PURCHASES intent to PlanningEngine and PaymentDecisionService", async () => {
    const plan = createShoppingPlan({ title: "Saturday Shopping" }) as any;
    addPlanItem(plan.planId, {
      merchant: { name: "Target" },
      purchase: { amount: 84.22, currency: "USD" },
    });
    mockedDecidePayment.mockResolvedValueOnce(mockDecision("Capital One Venture Rewards", 1.68));

    const res = await invokeRoute(intentRouter, "POST", "/intents", {
      type: "PLAN_PURCHASES",
      payload: {
        planId: plan.planId,
        wallet: { cards: [{ cardId: "capital-one-venture" }] },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.executedCapabilities).toEqual([
      "PlanningEngine",
      "PaymentDecisionService",
    ]);
    expect(res.body.result.estimatedTotalRewards).toBe(1.68);
  });

  test("routes COMPLETE_PURCHASE intent to planning completion", async () => {
    const plan = createShoppingPlan({ title: "Saturday Shopping" }) as any;
    const item = addPlanItem(plan.planId, {
      merchant: { name: "Target" },
      purchase: { amount: 84.22, currency: "USD" },
    }) as any;

    const res = await invokeRoute(intentRouter, "POST", "/intents", {
      type: "COMPLETE_PURCHASE",
      payload: {
        planId: plan.planId,
        itemId: item.itemId,
        decisionId: "pdec_done",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.executedCapabilities).toEqual(["PlanningEngine", "PaymentJourney"]);
    expect(res.body.result.item.completionState).toBe("completed");
    expect(res.body.warnings[0]).toMatch(/local Payment Journey/i);
  });

  test("records intent execution events", async () => {
    mockedDecidePayment.mockResolvedValueOnce(mockDecision());
    await invokeRoute(intentRouter, "POST", "/intents", {
      type: "SMART_PAY",
      payload: {
        merchant: { name: "Amazon" },
        purchase: { amount: 10, currency: "USD" },
        wallet: { cards: [{ cardId: "capital-one-venture" }] },
      },
    });

    const events = await invokeRoute(intentRouter, "GET", "/intent-events");

    expect(events.body.events).toHaveLength(1);
    expect(events.body.events[0]).toEqual(
      expect.objectContaining({
        intentType: "SMART_PAY",
        executedCapabilities: ["PaymentDecisionService"],
        success: true,
      }),
    );
  });

  test("OpenAPI includes financial intent endpoints and schemas", async () => {
    const res = await invokeRoute(paymentRouter, "GET", "/openapi.json");

    expect(res.body.paths["/api/v1/intents"]).toBeDefined();
    expect(res.body.paths["/api/v1/intents/{intentId}"]).toBeDefined();
    expect(res.body.components.schemas.FinancialIntentRequest).toBeDefined();
    expect(res.body.components.schemas.FinancialIntentResponse).toBeDefined();
  });
});
