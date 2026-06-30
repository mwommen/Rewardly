jest.mock("../src/db", () => ({
  getCardsCollection: jest.fn(),
  getLinkedAccountsCollection: jest.fn(),
  getUserBenefitStatesCollection: jest.fn(),
}));

import router from "../src/routes/plaidRoutes";
import { getLinkedAccountsCollection } from "../src/db";

const mockedGetLinkedAccountsCollection = getLinkedAccountsCollection as jest.MockedFunction<typeof getLinkedAccountsCollection>;

function makeLinkedCollection(storage: any[]) {
  return {
    updateOne: jest.fn(async (filter: any, update: any, opts?: any) => {
      const idx = storage.findIndex((d) => String(d._id) === String(filter._id) || (d.userId === filter.userId && d.itemId === filter.itemId));
      if (idx >= 0) {
        storage[idx] = { ...storage[idx], ...(update.$set || {}) };
        return { matchedCount: 1 } as any;
      }
      const doc = { ...(update.$set || {}), ...(update.$setOnInsert || {}), _id: `doc${storage.length}` };
      storage.push(doc);
      return { matchedCount: 0, upsertedId: doc._id } as any;
    }),
    find: jest.fn(() => ({ toArray: async () => storage })),
    updateMany: jest.fn(async () => ({ matchedCount: 0 })),
  } as any;
}

async function invokeRoute(router: any, method: string, url: string, body?: any) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = { method, url, originalUrl: url, path: parsed.pathname, headers: {}, query: Object.fromEntries(parsed.searchParams.entries()), body: body || {}, params: {} };
  const res: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(payload: unknown) { this.body = payload; return this; } };

  await new Promise<void>((resolve, reject) => {
    (router as any).handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

describe("remap-accounts mapping variations", () => {
  beforeEach(() => jest.clearAllMocks());

  test("handles varied account names and types", async () => {
    const linkedStorage: any[] = [
      {
        _id: "one",
        userId: "devUser",
        itemId: "item_1",
        accounts: [
          { account_id: "a1", name: "Chase Sapphire Reserve", official_name: "Sapphire Reserve", type: "credit", subtype: "credit card" },
          { account_id: "a2", name: "sapphire reserve card", official_name: "Sapphire", type: "credit", subtype: "credit card" },
          { account_id: "a3", name: "CAPITAL ONE VENTURE X", official_name: "Venture X", type: "credit", subtype: "credit card" },
          { account_id: "a4", name: "Interest Checking", official_name: "Checking", type: "depository", subtype: "checking" },
          { account_id: "a5", name: "Amex Gold", official_name: "Gold", type: "credit", subtype: "credit card" },
        ],
      },
    ];

    mockedGetLinkedAccountsCollection.mockResolvedValueOnce(makeLinkedCollection(linkedStorage));

    const res = await invokeRoute(router, "POST", "/remap-accounts", { userId: "devUser" });
    expect(res.statusCode).toBe(200);
    const updated = linkedStorage[0];
    expect(updated.accounts.find((a: any) => a.account_id === "a1").mappedCardSlug).toBe("chase-sapphire-reserve");
    expect(updated.accounts.find((a: any) => a.account_id === "a2").mappedCardSlug).toBe("chase-sapphire-reserve");
    expect(updated.accounts.find((a: any) => a.account_id === "a3").mappedCardSlug).toBe("capital-one-venture-x");
    expect(updated.accounts.find((a: any) => a.account_id === "a4").mappedCardSlug).toBe("");
    expect(updated.accounts.find((a: any) => a.account_id === "a5").mappedCardSlug).toBe("amex-gold");
  });
});
