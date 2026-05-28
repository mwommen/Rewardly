jest.mock("../src/services/recommendationService", () => ({
  recommendBestCards: jest.fn(),
  recommendAllBenefits: jest.fn(),
}));

import router from "../src/routes/recommendationRoutes";
import { recommendAllBenefits, recommendBestCards } from "../src/services/recommendationService";

const mockedRecommendBestCards = recommendBestCards as jest.MockedFunction<typeof recommendBestCards>;
const mockedRecommendAllBenefits = recommendAllBenefits as jest.MockedFunction<typeof recommendAllBenefits>;

async function invokeRoute(method: string, url: string) {
  const parsed = new URL(`http://localhost${url}`);
  const query = Object.fromEntries(parsed.searchParams.entries());
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: {},
    query,
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
    (router as any).handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

describe("recommendationRoutes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /best enforces merchant and projects requested fields", async () => {
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "lululemon",
      amount: 50,
      categoriesUsed: ["other"],
      recommendations: [
        {
          slug: "amex-platinum",
          name: "Amex Platinum",
          effectiveRate: 1.2,
          annualFee: 695,
          reason: "exact benefit",
          extraField: "hidden",
        },
        {
          slug: "amex-gold",
          name: "Amex Gold",
          effectiveRate: 0.8,
          annualFee: 325,
          reason: "fallback",
        },
      ],
    } as any);

    const missingRes = await invokeRoute("GET", "/best");
    expect(missingRes.statusCode).toBe(400);

    const res = await invokeRoute(
      "GET",
      "/best?merchant=lululemon&limit=1&fields=slug,name,effectiveRate,annualFee,extraField"
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.recommendations).toEqual([
      {
        slug: "amex-platinum",
        name: "Amex Platinum",
        effectiveRate: 1.2,
        annualFee: 695,
      },
    ]);
  });

  test("GET /offers filters items without perks and supports grouped output", async () => {
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "dining",
      amount: 40,
      categoriesUsed: ["restaurants"],
      offers: [
        { slug: "a", name: "A", reason: "category:dining", perks: ["3x dining"] },
        { slug: "b", name: "B", reason: "rotating:groceries", perks: ["5% rotating"] },
        { slug: "c", name: "C", reason: "flat", perks: [] },
      ],
    } as any);

    const res = await invokeRoute(
      "GET",
      "/offers?merchant=dining&group=true&fields=slug,name,reason,perks"
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.groupedOffers.Dining).toHaveLength(1);
    expect(res.body.groupedOffers.Rotating).toHaveLength(1);
    expect(res.body.groupedOffers["Base/Other"]).toHaveLength(0);
  });
});
