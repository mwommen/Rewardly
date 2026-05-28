jest.mock("../src/db", () => ({
  getUserBenefitStatesCollection: jest.fn(),
}));

import router from "../src/routes/userBenefitRoutes";
import { getUserBenefitStatesCollection } from "../src/db";

const mockedGetUserBenefitStatesCollection =
  getUserBenefitStatesCollection as jest.MockedFunction<typeof getUserBenefitStatesCollection>;

function makeCollection(initialDocs: any[] = []) {
  const docs = [...initialDocs];
  return {
    find: jest.fn((query: any) => ({
      toArray: async () => docs.filter((doc) => doc.userId === query.userId),
    })),
    findOne: jest.fn(async (query: any) =>
      docs.find((doc) => doc.userId === query.userId && doc.benefitKey === query.benefitKey) || null
    ),
    updateOne: jest.fn(async (query: any, update: any) => {
      const index = docs.findIndex((doc) => doc.userId === query.userId && doc.benefitKey === query.benefitKey);
      const nextDoc = { ...(index >= 0 ? docs[index] : {}), ...(update?.$set || {}) };
      if (index >= 0) docs[index] = nextDoc;
      else docs.push(nextDoc);
      return { acknowledged: true };
    }),
    deleteOne: jest.fn(async (query: any) => {
      const index = docs.findIndex((doc) => doc.userId === query.userId && doc.benefitKey === query.benefitKey);
      if (index >= 0) {
        docs.splice(index, 1);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    }),
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

describe("userBenefitRoutes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /user-benefits returns saved states for a user", async () => {
    mockedGetUserBenefitStatesCollection.mockResolvedValueOnce(
      makeCollection([
        {
          userId: "devUser",
          benefitKey: "amex-gold::$200 Uber Cash (annual; monthly accrual)::year",
          enrolled: true,
          remindEnabled: true,
        },
      ])
    );

    const res = await invokeRoute("GET", "/user-benefits?userId=devUser");

    expect(res.statusCode).toBe(200);
    expect(res.body.states).toHaveLength(1);
    expect(res.body.states[0].benefitKey).toContain("Uber Cash");
    expect(res.body.states[0].enrolled).toBe(true);
    expect(res.body.states[0].remindEnabled).toBe(true);
  });

  test("POST /user-benefits/state upserts a state", async () => {
    mockedGetUserBenefitStatesCollection.mockResolvedValueOnce(makeCollection());

    const res = await invokeRoute("POST", "/user-benefits/state", {
      userId: "devUser",
      benefitKey: "amex-gold::$400 Resy dining credit (quarterly buckets)::year",
      cardSlug: "amex-gold",
      label: "$400 Resy dining credit (quarterly buckets)",
      enrolled: true,
      usedAt: "2026-04-17T00:00:00.000Z",
      remindEnabled: true,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.state.enrolled).toBe(true);
    expect(res.body.state.usedAt).toBe("2026-04-17T00:00:00.000Z");
    expect(res.body.state.remindEnabled).toBe(true);
  });

  test("DELETE /user-benefits/state removes saved state", async () => {
    mockedGetUserBenefitStatesCollection.mockResolvedValueOnce(
      makeCollection([{ userId: "devUser", benefitKey: "test-key" }])
    );

    const res = await invokeRoute("DELETE", "/user-benefits/state?userId=devUser&benefitKey=test-key");

    expect(res.statusCode).toBe(200);
    expect(res.body.deletedCount).toBe(1);
  });
});
