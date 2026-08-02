jest.mock("../src/db", () => ({
  getAnalyticsCollection: jest.fn(),
  getBetaExtensionConnectionsCollection: jest.fn(),
  getBetaUsersCollection: jest.fn(),
  getBetaWalletsCollection: jest.fn(),
  getCardsCollection: jest.fn(),
  getFeedbackCollection: jest.fn(),
}));

jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

import betaAuthRouter from "../src/routes/betaAuthRoutes";
import analyticsRouter from "../src/routes/analyticsRoutes";
import decisionRouter from "../src/routes/decisionRoutes";
import feedbackRouter from "../src/routes/feedbackRoutes";
import {
  getAnalyticsCollection,
  getBetaExtensionConnectionsCollection,
  getBetaUsersCollection,
  getBetaWalletsCollection,
  getCardsCollection,
  getFeedbackCollection,
} from "../src/db";
import { decidePayment } from "../src/services/paymentDecisionService";
import {
  createBetaUser,
  revokeBetaUser,
} from "../src/services/betaAuthService";

const mockedUsers = getBetaUsersCollection as jest.MockedFunction<
  typeof getBetaUsersCollection
>;
const mockedWallets = getBetaWalletsCollection as jest.MockedFunction<
  typeof getBetaWalletsCollection
>;
const mockedConnections =
  getBetaExtensionConnectionsCollection as jest.MockedFunction<
    typeof getBetaExtensionConnectionsCollection
  >;
const mockedCards = getCardsCollection as jest.MockedFunction<
  typeof getCardsCollection
>;
const mockedAnalytics = getAnalyticsCollection as jest.MockedFunction<
  typeof getAnalyticsCollection
>;
const mockedFeedback = getFeedbackCollection as jest.MockedFunction<
  typeof getFeedbackCollection
>;
const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

const ORIGINAL_ENV = process.env;

function memoryCollection(seed: any[] = []) {
  const docs = seed;
  return {
    docs,
    insertOne: jest.fn(async (doc: any) => {
      docs.push({ ...doc });
      return { insertedId: doc.userId || doc.eventId || doc.feedbackId };
    }),
    findOne: jest.fn(async (query: any) =>
      docs.find((doc) =>
        Object.entries(query).every(([key, value]) => doc[key] === value),
      ) || null,
    ),
    updateOne: jest.fn(async (filter: any, update: any, options?: any) => {
      let doc = docs.find((candidate) =>
        Object.entries(filter).every(([key, value]) => candidate[key] === value),
      );
      if (!doc && options?.upsert) {
        doc = { ...filter, ...(update.$setOnInsert || {}) };
        docs.push(doc);
      }
      if (doc) Object.assign(doc, update.$setOnInsert || {}, update.$set || {});
      return { modifiedCount: doc ? 1 : 0, upsertedCount: doc ? 0 : 1 };
    }),
    find: jest.fn(() => ({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn(async () => [...docs]),
    })),
    deleteMany: jest.fn(async () => ({ deletedCount: 0 })),
    createIndex: jest.fn(async () => "index"),
  } as any;
}

async function invokeRoute(
  router: any,
  method: string,
  url: string,
  body?: any,
  headers: Record<string, string> = {},
) {
  const parsed = new URL(`http://localhost${url}`);
  const req: any = {
    method,
    url,
    originalUrl: url,
    path: parsed.pathname,
    headers,
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
  };

  await new Promise<void>((resolve, reject) => {
    router.handle(req, res, (err: unknown) => (err ? reject(err) : resolve()));
    setImmediate(resolve);
  });

  return res;
}

describe("private beta qualification flow", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      REWARDLY_ALLOW_DEV_OVERRIDES: "false",
    };
    jest.clearAllMocks();

    mockedUsers.mockResolvedValue(memoryCollection());
    mockedWallets.mockResolvedValue(memoryCollection());
    mockedConnections.mockResolvedValue(memoryCollection());
    mockedCards.mockResolvedValue(
      memoryCollection([
        { slug: "amex-gold", name: "American Express Gold Card" },
        { slug: "capital-one-venture", name: "Capital One Venture Rewards" },
        { slug: "chase-sapphire-preferred", name: "Chase Sapphire Preferred" },
      ]),
    );
    mockedAnalytics.mockResolvedValue(memoryCollection());
    mockedFeedback.mockResolvedValue(memoryCollection());
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("executes two isolated beta users through activation, extension connection, wallet, decision, feedback, analytics, and revocation", async () => {
    const userAInvite = await createBetaUser({ email: "user-a@example.test" });
    const userBInvite = await createBetaUser({ email: "user-b@example.test" });

    const activateA = await invokeRoute(betaAuthRouter, "POST", "/beta/activate", {
      activationToken: userAInvite.activationToken,
    });
    expect(activateA.statusCode).toBe(200);
    const sessionA = activateA.body.sessionToken;

    const reuseInviteA = await invokeRoute(betaAuthRouter, "POST", "/beta/activate", {
      activationToken: userAInvite.activationToken,
    });
    expect(reuseInviteA.statusCode).toBe(401);

    const connectA = await invokeRoute(
      betaAuthRouter,
      "POST",
      "/beta/extension-connections",
      {},
      { authorization: `Bearer ${sessionA}` },
    );
    expect(connectA.statusCode).toBe(200);

    const redeemA = await invokeRoute(
      betaAuthRouter,
      "POST",
      "/beta/extension-connections/redeem",
      { connectionCode: connectA.body.connectionCode },
    );
    expect(redeemA.statusCode).toBe(200);
    const extensionSessionA = redeemA.body.sessionToken;

    const reuseConnectionA = await invokeRoute(
      betaAuthRouter,
      "POST",
      "/beta/extension-connections/redeem",
      { connectionCode: connectA.body.connectionCode },
    );
    expect(reuseConnectionA.statusCode).toBe(401);

    const walletAUpdate = await invokeRoute(
      betaAuthRouter,
      "PUT",
      "/wallet/cards",
      {
        userId: "spoofed-user-b",
        cardSlugs: ["amex-gold", "capital-one-venture"],
      },
      { authorization: `Bearer ${extensionSessionA}` },
    );
    expect(walletAUpdate.statusCode).toBe(200);
    expect(walletAUpdate.body.wallet.cardSlugs).toEqual([
      "amex-gold",
      "capital-one-venture",
    ]);

    mockedDecidePayment.mockImplementation(async (input: any) => {
      const wallet = input.userId === activateA.body.user.userId
        ? ["amex-gold", "capital-one-venture"]
        : ["chase-sapphire-preferred"];
      return {
        recommendedCard: {
          card: {
            slug: wallet[0],
            name: wallet[0] === "amex-gold"
              ? "American Express Gold Card"
              : "Chase Sapphire Preferred",
          },
        },
        wallet: { userId: input.userId, cardSlugs: wallet },
        merchant: { name: "Amazon" },
      } as any;
    });

    const decisionA = await invokeRoute(
      decisionRouter,
      "POST",
      "/decisions/payment",
      { merchant: "Amazon", hostname: "www.amazon.com" },
      { authorization: `Bearer ${extensionSessionA}` },
    );
    expect(decisionA.statusCode).toBe(200);
    expect(decisionA.body.decision.recommendedCard.card.slug).toBe("amex-gold");
    expect(decisionA.body.decision.wallet.userId).toBe(activateA.body.user.userId);

    const feedbackA = await invokeRoute(feedbackRouter, "POST", "/feedback", {
      type: "recommendation_helpful",
      installationId: "install-a",
      sessionId: "session-a",
      merchantName: "Amazon",
      merchantDomain: "www.amazon.com",
      recommendedCardName: "American Express Gold Card",
    });
    expect(feedbackA.statusCode).toBe(200);

    const analyticsA = await invokeRoute(analyticsRouter, "POST", "/event", {
      installationId: "install-a",
      source: "chrome_extension",
      event: "recommendation_displayed",
      metadata: {
        sessionId: "session-a",
        merchant: "Amazon",
        stage: "payment",
        hasRecommendation: true,
      },
    });
    expect(analyticsA.statusCode).toBe(200);

    const activateB = await invokeRoute(betaAuthRouter, "POST", "/beta/activate", {
      activationToken: userBInvite.activationToken,
    });
    expect(activateB.statusCode).toBe(200);
    const sessionB = activateB.body.sessionToken;

    const connectB = await invokeRoute(
      betaAuthRouter,
      "POST",
      "/beta/extension-connections",
      {},
      { authorization: `Bearer ${sessionB}` },
    );
    const redeemB = await invokeRoute(
      betaAuthRouter,
      "POST",
      "/beta/extension-connections/redeem",
      { connectionCode: connectB.body.connectionCode },
    );
    expect(redeemB.statusCode).toBe(200);

    const walletBUpdate = await invokeRoute(
      betaAuthRouter,
      "PUT",
      "/wallet/cards",
      { userId: activateA.body.user.userId, cardSlugs: ["chase-sapphire-preferred"] },
      { authorization: `Bearer ${redeemB.body.sessionToken}` },
    );
    expect(walletBUpdate.statusCode).toBe(200);
    expect(walletBUpdate.body.wallet.cardSlugs).toEqual([
      "chase-sapphire-preferred",
    ]);

    const walletARead = await invokeRoute(
      betaAuthRouter,
      "GET",
      "/wallet",
      undefined,
      { authorization: `Bearer ${extensionSessionA}` },
    );
    const walletBRead = await invokeRoute(
      betaAuthRouter,
      "GET",
      "/wallet",
      undefined,
      { authorization: `Bearer ${redeemB.body.sessionToken}` },
    );
    expect(walletARead.body.wallet.cardSlugs).toEqual([
      "amex-gold",
      "capital-one-venture",
    ]);
    expect(walletBRead.body.wallet.cardSlugs).toEqual([
      "chase-sapphire-preferred",
    ]);

    const decisionB = await invokeRoute(
      decisionRouter,
      "POST",
      "/decisions/payment",
      { merchant: "Amazon", hostname: "www.amazon.com" },
      { authorization: `Bearer ${redeemB.body.sessionToken}` },
    );
    expect(decisionB.statusCode).toBe(200);
    expect(decisionB.body.decision.recommendedCard.card.slug).toBe(
      "chase-sapphire-preferred",
    );
    expect(decisionB.body.decision.wallet.userId).toBe(activateB.body.user.userId);

    await revokeBetaUser(activateA.body.user.userId);

    const revokedSessionA = await invokeRoute(
      betaAuthRouter,
      "GET",
      "/beta/session",
      undefined,
      { authorization: `Bearer ${extensionSessionA}` },
    );
    const revokedExtensionA = await invokeRoute(
      betaAuthRouter,
      "GET",
      "/wallet",
      undefined,
      { authorization: `Bearer ${extensionSessionA}` },
    );
    const revokedDecisionA = await invokeRoute(
      decisionRouter,
      "POST",
      "/decisions/payment",
      { merchant: "Amazon", hostname: "www.amazon.com" },
      { authorization: `Bearer ${extensionSessionA}` },
    );

    expect(revokedSessionA.statusCode).toBe(401);
    expect(revokedExtensionA.statusCode).toBe(401);
    expect(revokedDecisionA.statusCode).toBe(401);

    const stillActiveB = await invokeRoute(
      betaAuthRouter,
      "GET",
      "/wallet",
      undefined,
      { authorization: `Bearer ${redeemB.body.sessionToken}` },
    );
    expect(stillActiveB.statusCode).toBe(200);
    expect(stillActiveB.body.wallet.cardSlugs).toEqual([
      "chase-sapphire-preferred",
    ]);
  });
});
