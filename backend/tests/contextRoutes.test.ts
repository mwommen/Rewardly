jest.mock("../src/db", () => ({
  getUserPreferencesCollection: jest.fn(),
}));

jest.mock("../src/services/productionAuthService", () => {
  class AuthError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
      public retryable = false,
      public details?: unknown,
    ) {
      super(message);
    }
  }
  return {
    AuthError,
    createRequestId: () => "req_context",
    authenticateAccessToken: jest.fn(async (authorization?: string) => {
      const token = String(authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) {
        throw new AuthError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Sign in is required.",
        );
      }
      return {
        userId: token,
        authProviderUserId: `test:${token}`,
        email: `${token}@example.com`,
        requestId: "req_context",
      };
    }),
  };
});

import { getUserPreferencesCollection } from "../src/db";
import contextRouter from "../src/routes/v1/contextRoutes";

const mockedPreferencesCollection =
  getUserPreferencesCollection as jest.MockedFunction<
    typeof getUserPreferencesCollection
  >;

beforeEach(() => {
  mockedPreferencesCollection.mockResolvedValue(memoryCollection() as any);
});

describe("contextRoutes", () => {
  test("POST /context/validate normalizes context without auth", async () => {
    const res = await invokeRoute(contextRouter, "POST", "/context/validate", {
      purchase: { merchant: "Target", amount: 42, currency: "USD" },
      decisionPolicy: "cash_back",
      constraints: [{ type: "never_finance", value: true }],
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.context.decisionPolicy.objective).toBe("cash_back");
    expect(res.body.context.user.constraints[0].type).toBe("never_finance");
  });

  test("GET /decision-policies returns deterministic policy catalog", async () => {
    const res = await invokeRoute(contextRouter, "GET", "/decision-policies");

    expect(res.statusCode).toBe(200);
    expect(res.body.policies.map((policy: any) => policy.policyId)).toContain(
      "debt-avoidance",
    );
  });

  test("authenticated preferences can be patched and read", async () => {
    const collection = memoryCollection();
    mockedPreferencesCollection.mockResolvedValue(collection as any);

    const updated = await invokeRoute(
      contextRouter,
      "PATCH",
      "/preferences",
      {
        decisionPolicy: "debt-avoidance",
        preferences: [{ type: "minimize_complexity", value: true }],
      },
      { authorization: "Bearer usr_a" },
    );
    const fetched = await invokeRoute(
      contextRouter,
      "GET",
      "/preferences",
      undefined,
      { authorization: "Bearer usr_a" },
    );

    expect(updated.statusCode).toBe(200);
    expect(updated.body.preferences.decisionPolicy.policyId).toBe(
      "debt-avoidance",
    );
    expect(fetched.body.preferences.preferences[0].type).toBe(
      "minimize_complexity",
    );
  });

  test("authenticated context uses stored preferences", async () => {
    const collection = memoryCollection();
    mockedPreferencesCollection.mockResolvedValue(collection as any);
    await invokeRoute(
      contextRouter,
      "PATCH",
      "/preferences",
      { decisionPolicy: "minimize-complexity" },
      { authorization: "Bearer usr_a" },
    );

    const res = await invokeRoute(
      contextRouter,
      "POST",
      "/context",
      { purchase: { merchant: "Apple", amount: 999, currency: "USD" } },
      { authorization: "Bearer usr_a" },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.context.decisionPolicy.policyId).toBe(
      "minimize-complexity",
    );
  });

  test("protected context preferences require authentication", async () => {
    const res = await invokeRoute(contextRouter, "GET", "/preferences");

    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

async function invokeRoute(
  router: any,
  method: string,
  url: string,
  body?: any,
  headers?: Record<string, string>,
) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers: headers || {},
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
    setHeader: jest.fn(),
  };

  await new Promise<void>((resolve, reject) => {
    router.handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

function memoryCollection(seed: any[] = []) {
  const docs = seed.map((doc) => ({ ...doc }));
  return {
    docs,
    findOne: jest.fn(
      async (query: any) => docs.find((doc) => matches(doc, query)) || null,
    ),
    insertOne: jest.fn(async (doc: any) => {
      docs.push(doc);
      return { insertedId: doc.userId || docs.length };
    }),
    updateOne: jest.fn(async (query: any, update: any, options: any = {}) => {
      const index = docs.findIndex((doc) => matches(doc, query));
      if (index === -1) {
        if (!options.upsert) return { matchedCount: 0, modifiedCount: 0 };
        docs.push({
          ...query,
          ...(update.$setOnInsert || {}),
          ...(update.$set || {}),
        });
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      docs[index] = { ...docs[index], ...(update.$set || {}) };
      return { matchedCount: 1, modifiedCount: 1 };
    }),
  };
}

function matches(doc: any, query: any): boolean {
  return Object.entries(query || {}).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const expression = expected as any;
      if ("$in" in expression) return expression.$in.includes(actual);
      if ("$ne" in expression) return actual !== expression.$ne;
    }
    return actual === expected;
  });
}
