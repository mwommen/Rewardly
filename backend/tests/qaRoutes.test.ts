jest.mock("../src/db", () => ({
  getCardsCollection: jest.fn(),
  getLinkedAccountsCollection: jest.fn(),
}));

jest.mock("../src/services/benefitsQaService", () => ({
  findMerchantBenefits: jest.fn(),
}));

import router from "../src/routes/qaRoutes";
import { getCardsCollection, getLinkedAccountsCollection } from "../src/db";
import { findMerchantBenefits } from "../src/services/benefitsQaService";

const mockedGetCardsCollection = getCardsCollection as jest.MockedFunction<typeof getCardsCollection>;
const mockedGetLinkedAccountsCollection = getLinkedAccountsCollection as jest.MockedFunction<typeof getLinkedAccountsCollection>;
const mockedFindMerchantBenefits = findMerchantBenefits as jest.MockedFunction<typeof findMerchantBenefits>;

function makeCollection(docs: any[]) {
  return {
    find: jest.fn(() => ({
      toArray: async () => docs,
    })),
  } as any;
}

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

describe("qaRoutes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /qa/benefits requires merchant or host and returns matches", async () => {
    mockedFindMerchantBenefits.mockResolvedValueOnce([
      {
        card: { slug: "amex-gold", name: "Amex Gold" },
        credits: [{ label: "$10 dining credit" }],
      },
    ] as any);

    const missingRes = await invokeRoute("GET", "/qa/benefits");
    expect(missingRes.statusCode).toBe(400);

    const res = await invokeRoute("GET", "/qa/benefits?merchant=resy");
    expect(res.statusCode).toBe(200);
    expect(res.body.merchant).toBe("resy");
    expect(res.body.count).toBe(1);
  });

  test("GET /qa/summary returns readiness summary", async () => {
    mockedGetCardsCollection.mockResolvedValueOnce(
      makeCollection([
        {
          slug: "clean-card",
          name: "Clean Card",
          issuer: "Issuer",
          perks: ["Purchase protection"],
          merchantCredits: [{ label: "$10 dining credit", amountUSD: 10, period: "month" }],
          reviewStatus: "ok",
          scrapeQa: { needsReview: false, junkCount: 0, junkRatio: 0 },
        },
      ])
    );
    mockedGetLinkedAccountsCollection.mockResolvedValueOnce(
      makeCollection([
        {
          userId: "devUser",
          accounts: [
            { accountId: "1", type: "credit", subtype: "credit card", mappedCardSlug: "clean-card" },
            { accountId: "2", type: "credit", subtype: "credit card", mappedCardSlug: "unknown" },
          ],
        },
      ])
    );

    const res = await invokeRoute("GET", "/qa/summary?userId=devUser");

    expect(res.statusCode).toBe(200);
    expect(res.body.cards.total).toBe(1);
    expect(res.body.linkedAccounts.creditAccounts).toBe(2);
    expect(res.body.linkedAccounts.unresolvedMappings).toBe(1);
    expect(res.body.status).toBe("needs_attention");
  });
});
