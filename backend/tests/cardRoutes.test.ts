jest.mock("../src/db", () => ({
  getCardsCollection: jest.fn(),
  getLinkedAccountsCollection: jest.fn(),
}));

jest.mock("../src/utils/merchantMatching", () => ({
  collectCreditMatches: jest.fn(),
}));

import router from "../src/routes/cardRoutes";
import { getCardsCollection, getLinkedAccountsCollection } from "../src/db";
import { collectCreditMatches } from "../src/utils/merchantMatching";

const mockedGetCardsCollection = getCardsCollection as jest.MockedFunction<typeof getCardsCollection>;
const mockedGetLinkedAccountsCollection = getLinkedAccountsCollection as jest.MockedFunction<typeof getLinkedAccountsCollection>;
const mockedCollectCreditMatches = collectCreditMatches as jest.MockedFunction<typeof collectCreditMatches>;

function makeCollection(docs: any[]) {
  return {
    find: jest.fn(() => ({
      toArray: async () => docs,
    })),
  } as any;
}

async function invokeRoute(method: string, url: string, body?: any) {
  const parsed = new URL(`http://localhost${url}`);
  const query = Object.fromEntries(parsed.searchParams.entries());
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: {},
    query,
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
    (router as any).handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

describe("cardRoutes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /best-card-for-merchant restricts to linked cards and returns best linked match", async () => {
    const cards = [
      {
        slug: "amex-gold",
        name: "Amex Gold",
        issuer: "American Express",
        rewardsByCategory: { default: 1 },
        merchantCredits: [{ label: "$10 dining credit" }],
      },
      {
        slug: "chase-freedom-unlimited",
        name: "Freedom Unlimited",
        issuer: "Chase",
        rewardsByCategory: { default: 1.5 },
        merchantCredits: [],
      },
    ];
    const linkedDocs = [
      {
        userId: "devUser",
        accounts: [{ accountId: "1", mappedCardSlug: "amex-gold" }],
      },
    ];

    mockedGetCardsCollection.mockResolvedValueOnce(makeCollection(cards));
    mockedGetLinkedAccountsCollection.mockResolvedValueOnce(makeCollection(linkedDocs));
    mockedCollectCreditMatches.mockImplementation((card: any, merchant: string) => {
      if (card.slug === "amex-gold" && merchant.toLowerCase() === "restaurant") {
        return [{ label: "$10 dining credit", requiresEnrollment: true }];
      }
      return [];
    });

    const res = await invokeRoute("POST", "/best-card-for-merchant", {
      merchant: "restaurant",
      userId: "devUser",
      restrictToLinked: true,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.bestCard?.slug).toBe("amex-gold");
    expect(res.body.reason?.matches).toContain("$10 dining credit");
    expect(res.body.linkedAccountSlugs).toEqual(["amex-gold"]);
  });

  test("POST /best-card-for-merchant returns note when no linked cards are available", async () => {
    mockedGetCardsCollection.mockResolvedValueOnce(makeCollection([]));
    mockedGetLinkedAccountsCollection.mockResolvedValueOnce(makeCollection([]));

    const res = await invokeRoute("POST", "/best-card-for-merchant", {
      merchant: "restaurant",
      userId: "devUser",
      restrictToLinked: true,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.bestCard).toBeNull();
    expect(res.body.note).toBe("No linked cards found for this user.");
  });

  test("POST /best-card-for-merchant accepts manual card slugs for wallet testing", async () => {
    const cards = [
      {
        slug: "capital-one-savorone",
        name: "Capital One SavorOne",
        issuer: "Capital One",
        rewardsByCategory: { default: 1 },
        merchantCredits: [{ label: "Streaming bonus" }],
      },
    ];

    mockedGetCardsCollection.mockResolvedValueOnce(makeCollection(cards));
    mockedGetLinkedAccountsCollection.mockResolvedValueOnce(makeCollection([]));
    mockedCollectCreditMatches.mockImplementation((card: any, merchant: string) => {
      if (card.slug === "capital-one-savorone" && merchant.toLowerCase() === "streaming") {
        return [{ label: "Streaming bonus" }];
      }
      return [];
    });

    const res = await invokeRoute("POST", "/best-card-for-merchant", {
      merchant: "streaming",
      userId: "devUser",
      restrictToLinked: true,
      manualCardSlugs: ["capital-one-savorone"],
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.bestCard?.slug).toBe("capital-one-savorone");
    expect(res.body.linkedAccountSlugs).toEqual(["capital-one-savorone"]);
  });
});
