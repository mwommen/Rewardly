jest.mock("../src/db", () => ({
  getCardsCollection: jest.fn(),
  getLinkedAccountsCollection: jest.fn(),
  getUserBenefitStatesCollection: jest.fn(),
}));

// Mock Plaid before importing the routes
jest.mock("plaid", () => {
  return {
    PlaidApi: function () {
      return {
        itemPublicTokenExchange: async () => ({ data: { access_token: "access_123", item_id: "item_123" } }),
        itemGet: async () => ({ data: { item: { institution_id: "inst_1" } } }),
        institutionsGetById: async () => ({ data: { institution: { name: "Test Bank" } } }),
        accountsGet: async () => ({
          data: {
            accounts: [
              {
                account_id: "acc_1",
                mask: "1111",
                name: "Chase Sapphire Reserve",
                official_name: "Sapphire Reserve",
                type: "credit",
                subtype: "credit card",
              },
            ],
          },
        }),
      };
    },
    Configuration: function () {},
    PlaidEnvironments: { production: {}, development: {}, sandbox: {} },
    Products: { Auth: "auth", Transactions: "transactions" },
    CountryCode: { Us: "US" },
  };
});

import plaidRouter from "../src/routes/plaidRoutes";
import userBenefitRouter from "../src/routes/userBenefitRoutes";
import { getCardsCollection, getLinkedAccountsCollection, getUserBenefitStatesCollection } from "../src/db";

const mockedGetCardsCollection = getCardsCollection as jest.MockedFunction<typeof getCardsCollection>;
const mockedGetLinkedAccountsCollection = getLinkedAccountsCollection as jest.MockedFunction<typeof getLinkedAccountsCollection>;
const mockedGetUserBenefitStatesCollection = getUserBenefitStatesCollection as jest.MockedFunction<typeof getUserBenefitStatesCollection>;

function makeCollection(docs: any[]) {
  return {
    find: jest.fn(() => ({ toArray: async () => docs })),
    findOne: jest.fn(async (q: any) => docs.find((d) => d.userId === q.userId && d.benefitKey === q.benefitKey)),
    updateOne: jest.fn(async (filter: any, update: any, opts?: any) => {
      const existing = docs.find((d) => d.userId === filter.userId && d.benefitKey === filter.benefitKey);
      if (existing) Object.assign(existing, update.$set || {});
      else docs.push({ userId: filter.userId, benefitKey: filter.benefitKey, ...(update.$set || {}) });
      return { matchedCount: 1 } as any;
    }),
  } as any;
}

function makeLinkedCollection(storage: any[]) {
  return {
    updateOne: jest.fn(async (filter: any, update: any, opts?: any) => {
      // upsert by itemId
      const userId = filter.userId || (update.$set && update.$set.userId);
      const itemId = filter.itemId || (update.$set && update.$set.itemId);
      let idx = storage.findIndex((d) => d.userId === userId && d.itemId === itemId);
      if (idx >= 0) {
        storage[idx] = { ...storage[idx], ...(update.$set || {}) };
        return { matchedCount: 1 } as any;
      }
      const doc = { ...(update.$set || {}), ...(update.$setOnInsert || {}), _id: `doc${storage.length}` };
      storage.push(doc);
      return { matchedCount: 0, upsertedId: doc._id } as any;
    }),
    find: jest.fn(() => ({ toArray: async () => storage })),
    deleteMany: jest.fn(async () => ({ deletedCount: storage.length })),
  } as any;
}

async function invokeRoute(router: any, method: string, url: string, body?: any) {
  const parsed = new URL(`http://localhost${url}`);
  const query = Object.fromEntries(parsed.searchParams.entries());
  const req: any = { method, url, originalUrl: url, path: parsed.pathname, headers: {}, query, body: body || {}, params: {} };
  const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(payload: unknown) { this.body = payload; return this; } };

  await new Promise<void>((resolve, reject) => {
    (router as any).handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

describe("Plaid -> wallet summary E2E (mocked Plaid)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("exchange-public-token stores linked accounts and wallet summary picks up linked slug", async () => {
    // in-memory storage for linked docs
    const linkedStorage: any[] = [];
    const cards = [
      { slug: "chase-sapphire-reserve", name: "Chase Sapphire Reserve", rewardsByCategory: { travel: 3, dining: 3 }, annualFee: 550 },
      { slug: "capital-one-venture", name: "Capital One Venture", rewardsByCategory: { travel: 2 }, annualFee: 95 },
    ];

    mockedGetLinkedAccountsCollection.mockResolvedValueOnce(makeLinkedCollection(linkedStorage));
    mockedGetCardsCollection.mockResolvedValueOnce(makeCollection(cards));
    mockedGetUserBenefitStatesCollection.mockResolvedValueOnce(makeCollection([]));

    // Call exchange-public-token (will use mocked Plaid responses)
    const ex = await invokeRoute(plaidRouter, "POST", "/exchange-public-token", { public_token: "ptok_123", userId: "devUser" });
    expect(ex.statusCode).toBe(200);
    expect(ex.body.ok).toBe(true);

    // linkedStorage should now contain the upserted item with accounts
    expect(linkedStorage.length).toBeGreaterThanOrEqual(1);
    const saved = linkedStorage[0];
    expect(saved.accounts && saved.accounts.length).toBeGreaterThanOrEqual(1);
    // the mappedCardSlug should have been set by mapAccountToCardSlug
    expect(saved.accounts[0].mappedCardSlug).toBe("chase-sapphire-reserve");

    // Now invoke wallet summary which reads linked accounts and cards
    // Ensure mocked getLinkedAccountsCollection and getCardsCollection are returned again
    mockedGetLinkedAccountsCollection.mockResolvedValueOnce(makeLinkedCollection(linkedStorage));
    mockedGetCardsCollection.mockResolvedValueOnce(makeCollection(cards));
    mockedGetUserBenefitStatesCollection.mockResolvedValueOnce(makeCollection([]));

    const sum = await invokeRoute(userBenefitRouter, "GET", "/user-benefits/summary?userId=devUser");
    expect(sum.statusCode).toBe(200);
    expect(Array.isArray(sum.body.linkedCardSlugs)).toBe(true);
    expect(sum.body.linkedCardSlugs).toContain("chase-sapphire-reserve");
    // recommended card should be something other than the linked slug
    expect(sum.body.recommendedNextCard).toBeDefined();
  });
});
