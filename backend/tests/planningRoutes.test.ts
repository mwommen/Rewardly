jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

import planningRouter from "../src/routes/v1/planningRoutes";
import paymentRouter from "../src/routes/v1/paymentDecisionRoutes";
import { decidePayment } from "../src/services/paymentDecisionService";
import { resetPlanningStoreForTests } from "../src/services/planningService";

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
    send(payload?: unknown) {
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

function mockDecision(cardName: string, estimatedValue: number) {
  const slug = cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    recommendedCard: {
      card: {
        slug,
        name: cardName,
        issuer: cardName.includes("Gold") ? "American Express" : "Capital One",
      },
      rewardEstimate: {
        estimatedValueUSD: estimatedValue,
      },
    },
    confidence: { score: 0.94, label: "high" },
    recommendationSummary: `${cardName} has the highest verified value.`,
    primaryReason: {
      detail: "Highest verified earning rate among the eligible cards in your wallet.",
    },
    decisionNarrative: {
      summary: `${cardName} is best for this planned purchase.`,
      estimatedRewardValue: estimatedValue,
      estimatedReward: `About $${estimatedValue.toFixed(2)} in estimated value.`,
      comparison: "Highest verified value among wallet cards.",
      primaryReason: {
        summary: "Highest verified earning rate among the eligible cards in your wallet.",
      },
    },
  } as any;
}

describe("planningRoutes", () => {
  beforeEach(() => {
    resetPlanningStoreForTests();
    jest.clearAllMocks();
  });

  test("creates and lists shopping plans", async () => {
    const create = await invokeRoute(planningRouter, "POST", "/plans", {
      title: "Saturday Shopping",
      notes: "Target and coffee",
    });
    const list = await invokeRoute(planningRouter, "GET", "/plans");

    expect(create.statusCode).toBe(201);
    expect(create.body.plan.planId).toMatch(/^plan_/);
    expect(create.body.plan.title).toBe("Saturday Shopping");
    expect(list.body.plans).toHaveLength(1);
  });

  test("adds planned purchases and prevents duplicates", async () => {
    const plan = await createPlan();
    const body = {
      merchant: { name: "Target", category: "general_retail" },
      purchase: { amount: 84.22, currency: "USD" },
    };

    const first = await invokeRoute(
      planningRouter,
      "POST",
      `/plans/${plan.planId}/items`,
      body,
    );
    const duplicate = await invokeRoute(
      planningRouter,
      "POST",
      `/plans/${plan.planId}/items`,
      body,
    );

    expect(first.statusCode).toBe(201);
    expect(first.body.item.itemId).toMatch(/^pitem_/);
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.body.error.message).toMatch(/already contains/i);
  });

  test("optimizes every planned purchase through PaymentDecisionService", async () => {
    const plan = await createPlan();
    await addItem(plan.planId, "Target", 84.22);
    await addItem(plan.planId, "Starbucks", 12);
    mockedDecidePayment
      .mockResolvedValueOnce(mockDecision("Capital One Venture Rewards", 1.68))
      .mockResolvedValueOnce(mockDecision("American Express Gold", 0.96));

    const res = await invokeRoute(
      planningRouter,
      "POST",
      `/plans/${plan.planId}/optimize`,
      {
        wallet: {
          cards: [{ cardId: "capital_one_venture" }, { cardId: "amex_gold" }],
        },
      },
    );

    expect(res.statusCode).toBe(200);
    expect(mockedDecidePayment).toHaveBeenCalledTimes(2);
    expect(mockedDecidePayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        merchant: "Target",
        amount: 84.22,
        manualCardSlugs: ["capital-one-venture", "amex-gold"],
        restrictToWallet: true,
      }),
    );
    expect(res.body.estimatedTotalRewards).toBe(2.64);
    expect(res.body.optimizedItems.map((item: any) => item.merchant.name)).toEqual([
      "Target",
      "Starbucks",
    ]);
  });

  test("tracks completed and remaining planned purchases", async () => {
    const plan = await createPlan();
    const target = await addItem(plan.planId, "Target", 84.22);
    await addItem(plan.planId, "Starbucks", 12);
    await invokeRoute(
      planningRouter,
      "PATCH",
      `/plans/${plan.planId}/items/${target.itemId}`,
      { decisionId: "pdec_done" },
    );
    mockedDecidePayment
      .mockResolvedValueOnce(mockDecision("Capital One Venture Rewards", 1.68))
      .mockResolvedValueOnce(mockDecision("American Express Gold", 0.96));

    const res = await invokeRoute(
      planningRouter,
      "POST",
      `/plans/${plan.planId}/optimize`,
      { wallet: { cards: [{ cardId: "capital-one-venture" }, { cardId: "amex-gold" }] } },
    );

    expect(res.body.progress).toEqual({
      plannedPurchases: 2,
      completedPurchases: 1,
      remainingPurchases: 1,
      estimatedRewardsEarned: 1.68,
      estimatedRewardsRemaining: 0.96,
    });
  });

  test("rejects empty plans, invalid plans, and missing plans", async () => {
    const invalid = await invokeRoute(planningRouter, "POST", "/plans", {
      title: "",
    });
    const plan = await createPlan();
    const emptyOptimize = await invokeRoute(
      planningRouter,
      "POST",
      `/plans/${plan.planId}/optimize`,
      { wallet: { cards: [{ cardId: "amex-gold" }] } },
    );
    const missing = await invokeRoute(planningRouter, "GET", "/plans/plan_missing");

    expect(invalid.statusCode).toBe(400);
    expect(emptyOptimize.statusCode).toBe(400);
    expect(missing.statusCode).toBe(404);
  });

  test("delete removes a plan from future reads", async () => {
    const plan = await createPlan();
    const deleted = await invokeRoute(planningRouter, "DELETE", `/plans/${plan.planId}`);
    const missing = await invokeRoute(planningRouter, "GET", `/plans/${plan.planId}`);

    expect(deleted.statusCode).toBe(204);
    expect(missing.statusCode).toBe(404);
  });

  test("OpenAPI includes planning endpoints and models", async () => {
    const res = await invokeRoute(paymentRouter, "GET", "/openapi.json");

    expect(res.body.paths["/api/v1/plans"]).toBeDefined();
    expect(res.body.paths["/api/v1/plans/{planId}/optimize"]).toBeDefined();
    expect(res.body.components.schemas.ShoppingPlan).toBeDefined();
    expect(res.body.components.schemas.PlanOptimizationResponse).toBeDefined();
  });
});

async function createPlan() {
  const res = await invokeRoute(planningRouter, "POST", "/plans", {
    title: "Saturday Shopping",
  });
  return res.body.plan;
}

async function addItem(planId: string, merchant: string, amount: number) {
  const res = await invokeRoute(planningRouter, "POST", `/plans/${planId}/items`, {
    merchant: { name: merchant },
    purchase: { amount, currency: "USD" },
  });
  return res.body.item;
}
