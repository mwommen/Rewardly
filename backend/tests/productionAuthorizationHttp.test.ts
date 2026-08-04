jest.mock("../src/db", () => ({
  connectDB: jest.fn(),
  getDb: jest.fn(async () => ({ command: jest.fn(async () => ({ ok: 1 })) })),
  getCardsCollection: jest.fn(),
  getLinkedAccountsCollection: jest.fn(async () => ({ find: jest.fn() })),
  getUserBenefitStatesCollection: jest.fn(async () => ({ find: jest.fn() })),
  getAnalyticsCollection: jest.fn(async () => ({ insertOne: jest.fn() })),
  getFeedbackCollection: jest.fn(async () => ({ insertOne: jest.fn() })),
  getBetaUsersCollection: jest.fn(async () => ({ findOne: jest.fn() })),
  getBetaWalletsCollection: jest.fn(async () => ({ findOne: jest.fn() })),
  getBetaExtensionConnectionsCollection: jest.fn(async () => ({ findOne: jest.fn() })),
  getRewardlyUsersCollection: jest.fn(),
  getRewardlySessionsCollection: jest.fn(),
  getUserWalletsCollection: jest.fn(),
  getPaymentJourneyCollection: jest.fn(),
  getUserShoppingPlansCollection: jest.fn(),
  getUserPreferencesCollection: jest.fn(),
}));

jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(async () => ({
    recommendedCard: null,
    alternativeCards: [],
    primaryReason: null,
    unlockedBenefits: [],
    confidence: { score: 0, label: "unknown" },
    recommendationSummary: "Add cards to your wallet to get personalized recommendations.",
  })),
}));

jest.mock("../src/routes/scrapeRoutes", () => {
  const express = require("express");
  return { __esModule: true, default: express.Router() };
});

import http from "http";
import type { AddressInfo } from "net";
import app from "../src/app";
import {
  getCardsCollection,
  getPaymentJourneyCollection,
  getRewardlySessionsCollection,
  getRewardlyUsersCollection,
  getUserPreferencesCollection,
  getUserShoppingPlansCollection,
  getUserWalletsCollection,
} from "../src/db";

const mockedCards = getCardsCollection as jest.MockedFunction<typeof getCardsCollection>;
const mockedUsers = getRewardlyUsersCollection as jest.MockedFunction<
  typeof getRewardlyUsersCollection
>;
const mockedSessions = getRewardlySessionsCollection as jest.MockedFunction<
  typeof getRewardlySessionsCollection
>;
const mockedWallets = getUserWalletsCollection as jest.MockedFunction<
  typeof getUserWalletsCollection
>;
const mockedJourney = getPaymentJourneyCollection as jest.MockedFunction<
  typeof getPaymentJourneyCollection
>;
const mockedPlans = getUserShoppingPlansCollection as jest.MockedFunction<
  typeof getUserShoppingPlansCollection
>;
const mockedPreferences = getUserPreferencesCollection as jest.MockedFunction<
  typeof getUserPreferencesCollection
>;

let server: http.Server;
let baseUrl: string;
let users: ReturnType<typeof memoryCollection>;
let sessions: ReturnType<typeof memoryCollection>;
let wallets: ReturnType<typeof memoryCollection>;
let journey: ReturnType<typeof memoryCollection>;
let plans: ReturnType<typeof memoryCollection>;
let preferences: ReturnType<typeof memoryCollection>;

beforeAll((done) => {
  process.env.REWARDLY_DISABLE_REQUEST_ANALYTICS = "true";
  process.env.REWARDLY_DISABLE_AUTH_RATE_LIMITS = "true";
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  users = memoryCollection();
  sessions = memoryCollection();
  wallets = memoryCollection();
  journey = memoryCollection();
  plans = memoryCollection();
  preferences = memoryCollection();
  mockedUsers.mockResolvedValue(users as any);
  mockedSessions.mockResolvedValue(sessions as any);
  mockedWallets.mockResolvedValue(wallets as any);
  mockedJourney.mockResolvedValue(journey as any);
  mockedPlans.mockResolvedValue(plans as any);
  mockedPreferences.mockResolvedValue(preferences as any);
  mockedCards.mockResolvedValue(
    memoryCollection([
      { slug: "amex-gold" },
      { slug: "capital-one-venture" },
      { slug: "chase-sapphire-preferred" },
    ]) as any,
  );
});

describe("production auth HTTP authorization", () => {
  test("users cannot read or mutate each other's wallet, journey, plans, or preferences", async () => {
    const userA = await signup("a@example.com");
    const userB = await signup("b@example.com");

    await request("PUT", "/api/v1/me/wallet", { cardSlugs: ["amex-gold"], userId: userB.user.userId }, userA.accessToken);
    await request("PUT", "/api/v1/me/wallet", { cardSlugs: ["capital-one-venture"] }, userB.accessToken);
    await request("POST", "/api/v1/me/payment-journey", { merchant: "Amazon", amount: 12 }, userA.accessToken);
    const planB = await request("POST", "/api/v1/me/plans", { title: "B plan" }, userB.accessToken);
    await request("PUT", "/api/v1/me/preferences", { favoriteMerchants: [{ name: "Target" }] }, userA.accessToken);

    const walletA = await request("GET", "/api/v1/me/wallet", undefined, userA.accessToken);
    const walletB = await request("GET", "/api/v1/me/wallet", undefined, userB.accessToken);
    const journeyB = await request("GET", "/api/v1/me/payment-journey", undefined, userB.accessToken);
    const prefsB = await request("GET", "/api/v1/me/preferences", undefined, userB.accessToken);
    const bPlanFromA = await request("GET", `/api/v1/me/plans/${planB.body.plan.planId}`, undefined, userA.accessToken);

    expect(walletA.body.wallet.cardSlugs).toEqual(["amex-gold"]);
    expect(walletB.body.wallet.cardSlugs).toEqual(["capital-one-venture"]);
    expect(journeyB.body.payments).toEqual([]);
    expect(prefsB.body.preferences.favoriteMerchants).toEqual([]);
    expect(bPlanFromA.status).toBe(404);
  });

  test("deleted account can recreate the same email and old token loses access", async () => {
    const first = await signup("recreate@example.com");
    const duplicate = await request("POST", "/api/v1/auth/signup", {
      email: "recreate@example.com",
      password: "secure-password",
    });
    expect(duplicate.status).toBe(409);

    const deleted = await request("DELETE", "/api/v1/me/account", undefined, first.accessToken);
    expect(deleted.status).toBe(200);
    expect(users.docs[0].email).toMatch(/^deleted\+/);

    const oldTokenAccess = await request("GET", "/api/v1/me/wallet", undefined, first.accessToken);
    expect(oldTokenAccess.status).toBe(401);

    const second = await signup("recreate@example.com");
    expect(second.user.email).toBe("recreate@example.com");
    expect(second.user.userId).not.toBe(first.user.userId);
  });

  test("suspended, invalid, and expired sessions fail correctly", async () => {
    const session = await signup("session@example.com");

    users.docs[0].status = "suspended";
    expect((await request("GET", "/api/v1/me/wallet", undefined, session.accessToken)).status).toBe(403);

    users.docs[0].status = "active";
    expect((await request("GET", "/api/v1/me/wallet", undefined, "not-a-token")).status).toBe(401);

    sessions.docs[0].expiresAt = new Date(Date.now() - 1000);
    const expired = await request("GET", "/api/v1/me/wallet", undefined, session.accessToken);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("SESSION_EXPIRED");
  });

  test("auth rate limits are endpoint-specific and return Retry-After", async () => {
    process.env.REWARDLY_DISABLE_AUTH_RATE_LIMITS = "false";
    process.env.REWARDLY_AUTH_RATE_LIMIT_SIGNIN_COUNT = "1";
    process.env.REWARDLY_AUTH_RATE_LIMIT_SIGNIN_WINDOW_MS = "60000";

    await signup("limit@example.com");
    const first = await request("POST", "/api/v1/auth/signin", {
      email: "limit@example.com",
      password: "wrong-password",
    });
    const second = await request("POST", "/api/v1/auth/signin", {
      email: "limit@example.com",
      password: "wrong-password",
    });

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expect(second.headers["retry-after"]).toBeTruthy();

    process.env.REWARDLY_DISABLE_AUTH_RATE_LIMITS = "true";
    delete process.env.REWARDLY_AUTH_RATE_LIMIT_SIGNIN_COUNT;
    delete process.env.REWARDLY_AUTH_RATE_LIMIT_SIGNIN_WINDOW_MS;
  });
});

async function signup(email: string) {
  const response = await request("POST", "/api/v1/auth/signup", {
    email,
    password: "secure-password",
  });
  expect(response.status).toBe(201);
  return response.body;
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<{ status: number; body: any; text: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: any = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode || 0, body: parsed, text, headers: res.headers });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function memoryCollection(seed: any[] = []) {
  const docs = seed.map((doc) => ({ ...doc }));
  return {
    docs,
    findOne: jest.fn(async (query: any) => docs.find((doc) => matches(doc, query)) || null),
    insertOne: jest.fn(async (doc: any) => {
      docs.push(doc);
      return { insertedId: doc.userId || doc.sessionId || doc.paymentId || docs.length };
    }),
    updateOne: jest.fn(async (query: any, update: any, options: any = {}) => {
      const index = docs.findIndex((doc) => matches(doc, query));
      if (index === -1) {
        if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        docs.push({ ...query, ...(update.$setOnInsert || {}), ...(update.$set || {}) });
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }
      docs[index] = { ...docs[index], ...(update.$set || {}) };
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }),
    updateMany: jest.fn(async (query: any, update: any) => {
      let modifiedCount = 0;
      docs.forEach((doc, index) => {
        if (matches(doc, query)) {
          docs[index] = { ...doc, ...(update.$set || {}) };
          modifiedCount += 1;
        }
      });
      return { modifiedCount };
    }),
    createIndex: jest.fn(async () => "idx"),
    find: jest.fn((query: any = {}) => {
      const found = docs.filter((doc) => matches(doc, query));
      return {
        sort: () => ({ limit: () => ({ toArray: async () => found }), toArray: async () => found }),
        limit: () => ({ toArray: async () => found }),
        toArray: async () => found,
      };
    }),
  };
}

function matches(doc: any, query: any): boolean {
  return Object.entries(query || {}).every(([key, expected]) => {
    if (key === "$or") return (expected as any[]).some((child) => matches(doc, child));
    const actual = doc[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const expression = expected as any;
      if ("$in" in expression) return expression.$in.includes(actual);
      if ("$ne" in expression) return actual !== expression.$ne;
    }
    return actual === expected;
  });
}
