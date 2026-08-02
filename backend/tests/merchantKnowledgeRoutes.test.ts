import merchantKnowledgeRouter from "../src/routes/v1/merchantKnowledgeRoutes";
import paymentRouter from "../src/routes/v1/paymentDecisionRoutes";
import {
  getMerchantInsight,
  getMerchantProfile,
  searchMerchantProfiles,
} from "../src/services/merchantKnowledgeService";
import { resolveMerchant } from "../src/services/merchantDetectionService";

async function invokeRoute(router: any, method: string, url: string) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: {},
    query: Object.fromEntries(parsed.searchParams.entries()),
    body: {},
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

describe("merchantKnowledgeRoutes", () => {
  test("GET /merchants returns centralized merchant profiles", async () => {
    const res = await invokeRoute(merchantKnowledgeRouter, "GET", "/merchants?limit=5");

    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        merchantCount: expect.any(Number),
        supportedCapabilities: expect.arrayContaining(["merchant_lookup", "merchant_search"]),
      }),
    );
    expect(res.body.merchants[0]).toEqual(
      expect.objectContaining({
        merchantId: expect.any(String),
        displayName: expect.any(String),
        aliases: expect.any(Array),
        supportedPaymentMethods: expect.any(Array),
        loyaltyPrograms: expect.any(Array),
        tags: expect.any(Array),
        lastUpdated: expect.any(String),
      }),
    );
  });

  test("GET /merchants/:id returns merchant metadata", async () => {
    const res = await invokeRoute(merchantKnowledgeRouter, "GET", "/merchants/amazon");

    expect(res.statusCode).toBe(200);
    expect(res.body.merchant).toEqual(
      expect.objectContaining({
        merchantId: "amazon",
        displayName: "Amazon",
        parentCompany: "Amazon",
        domains: expect.arrayContaining(["amazon.com"]),
        loyaltyPrograms: expect.arrayContaining(["Amazon Prime"]),
        metadata: expect.objectContaining({
          registryVersion: expect.any(String),
          merchantType: "marketplace",
        }),
      }),
    );
  });

  test("GET /merchant-search supports aliases, partial matches, misspellings, and categories", async () => {
    const alias = await invokeRoute(merchantKnowledgeRouter, "GET", "/merchant-search?q=amzn%20mktp");
    const partial = await invokeRoute(merchantKnowledgeRouter, "GET", "/merchant-search?q=starb");
    const misspelling = searchMerchantProfiles({ query: "starbuks" });
    const category = await invokeRoute(merchantKnowledgeRouter, "GET", "/merchant-search?q=coffee");

    expect(alias.body.merchants[0]).toEqual(
      expect.objectContaining({
        merchantId: "amazon",
        matchType: "alias",
      }),
    );
    expect(partial.body.merchants[0].merchantId).toBe("starbucks");
    expect(misspelling[0]).toEqual(
      expect.objectContaining({
        merchantId: "starbucks",
        matchType: "misspelling",
      }),
    );
    expect(category.body.merchants.map((merchant: any) => merchant.merchantId)).toContain(
      "starbucks",
    );
  });

  test("GET /merchant-categories exposes category lookup", async () => {
    const res = await invokeRoute(merchantKnowledgeRouter, "GET", "/merchant-categories");

    expect(res.statusCode).toBe(200);
    expect(res.body.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: "restaurant.coffee",
          parentCategoryId: "restaurant",
          merchantCount: expect.any(Number),
        }),
      ]),
    );
  });

  test("GET /merchant-insights returns deterministic merchant analytics", async () => {
    const res = await invokeRoute(
      merchantKnowledgeRouter,
      "GET",
      "/merchant-insights?merchantId=target",
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.insight).toEqual(
      expect.objectContaining({
        merchantId: "target",
        paymentJourneyEntries: expect.any(Number),
        mostUsedCard: expect.any(String),
        estimatedRewardsEarned: expect.any(Number),
        plannedSpendingEntries: expect.any(Number),
      }),
    );
  });

  test("existing merchant detection consumes Merchant Knowledge Service", () => {
    expect(resolveMerchant({ merchant: "amazon.com" })).toEqual(
      expect.objectContaining({
        name: "Amazon",
        category: "online_shopping",
        confidence: 0.95,
      }),
    );
    expect(getMerchantProfile("target")?.loyaltyPrograms).toEqual(
      expect.arrayContaining(["Target Circle"]),
    );
    expect(getMerchantInsight("unknown-merchant")).toBeNull();
  });

  test("OpenAPI includes merchant knowledge endpoints and schemas", async () => {
    const res = await invokeRoute(paymentRouter, "GET", "/openapi.json");

    expect(res.body.paths["/api/v1/merchants"]).toBeDefined();
    expect(res.body.paths["/api/v1/merchants/{merchantId}"]).toBeDefined();
    expect(res.body.paths["/api/v1/merchant-search"]).toBeDefined();
    expect(res.body.paths["/api/v1/merchant-categories"]).toBeDefined();
    expect(res.body.paths["/api/v1/merchant-insights"]).toBeDefined();
    expect(res.body.components.schemas.MerchantKnowledgeProfile).toBeDefined();
  });
});
