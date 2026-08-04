jest.mock("../src/db", () => ({
  getCardsCollection: jest.fn(),
  getRewardlyUsersCollection: jest.fn(),
  getRewardlySessionsCollection: jest.fn(),
  getUserWalletsCollection: jest.fn(),
  getPaymentJourneyCollection: jest.fn(),
  getUserShoppingPlansCollection: jest.fn(),
  getUserPreferencesCollection: jest.fn(),
}));

import {
  getCardsCollection,
  getPaymentJourneyCollection,
  getRewardlySessionsCollection,
  getRewardlyUsersCollection,
  getUserPreferencesCollection,
  getUserShoppingPlansCollection,
  getUserWalletsCollection,
} from "../src/db";
import {
  authenticateAccessToken,
  deleteRewardlyAccount,
  signInRewardlyUser,
  signUpRewardlyUser,
} from "../src/services/productionAuthService";
import {
  createPaymentJourney,
  getCloudWallet,
  migrateLocalData,
  replaceCloudWallet,
  updatePreferences,
} from "../src/services/userDataService";
import { redactForLog } from "../src/services/privacyLogService";

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

describe("production identity and cloud sync", () => {
  let users: ReturnType<typeof memoryCollection>;
  let sessions: ReturnType<typeof memoryCollection>;
  let wallets: ReturnType<typeof memoryCollection>;
  let journey: ReturnType<typeof memoryCollection>;
  let plans: ReturnType<typeof memoryCollection>;
  let preferences: ReturnType<typeof memoryCollection>;
  let cards: ReturnType<typeof memoryCollection>;

  beforeEach(() => {
    users = memoryCollection();
    sessions = memoryCollection();
    wallets = memoryCollection();
    journey = memoryCollection();
    plans = memoryCollection();
    preferences = memoryCollection();
    cards = memoryCollection([
      { slug: "amex-gold", name: "American Express Gold" },
      { slug: "capital-one-venture", name: "Capital One Venture Rewards" },
      { slug: "chase-sapphire-preferred", name: "Chase Sapphire Preferred" },
    ]);
    mockedUsers.mockResolvedValue(users as any);
    mockedSessions.mockResolvedValue(sessions as any);
    mockedWallets.mockResolvedValue(wallets as any);
    mockedJourney.mockResolvedValue(journey as any);
    mockedPlans.mockResolvedValue(plans as any);
    mockedPreferences.mockResolvedValue(preferences as any);
    mockedCards.mockResolvedValue(cards as any);
  });

  test("signup creates a server-owned user, session, wallet, and preferences", async () => {
    const session = await signUpRewardlyUser({
      email: "Beta@Test.com",
      password: "secure-password",
      displayName: "Beta User",
    });

    expect(session.accessToken).toHaveLength(43);
    expect(session.refreshToken).toHaveLength(43);
    expect(session.user).toMatchObject({
      email: "beta@test.com",
      displayName: "Beta User",
    });
    expect(await getCloudWallet(session.user.userId)).toMatchObject({ cardSlugs: [] });
    expect(await authenticateAccessToken(`Bearer ${session.accessToken}`, "req_test"))
      .toMatchObject({ userId: session.user.userId, email: "beta@test.com" });
  });

  test("signin rejects incorrect passwords and never returns password material", async () => {
    await signUpRewardlyUser({ email: "user@example.com", password: "correct-password" });

    await expect(
      signInRewardlyUser({ email: "user@example.com", password: "wrong-password" }),
    ).rejects.toMatchObject({ code: "INVALID_SESSION" });

    const userRecord = users.docs[0];
    expect(userRecord.passwordHash).toBeTruthy();
    expect(JSON.stringify(await signInRewardlyUser({
      email: "user@example.com",
      password: "correct-password",
    }))).not.toMatch(/passwordHash|passwordSalt|correct-password/);
  });

  test("wallet sync accepts only supported owned-card slugs and rejects duplicates", async () => {
    const { user } = await signUpRewardlyUser({
      email: "wallet@example.com",
      password: "secure-password",
    });

    await expect(
      replaceCloudWallet(user.userId, { cardSlugs: ["amex-gold", "amex_gold"] }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      replaceCloudWallet(user.userId, { cardSlugs: ["unknown-card"] }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      replaceCloudWallet(user.userId, { cardSlugs: ["amex_gold", "capital-one-venture"] }),
    ).resolves.toMatchObject({ cardSlugs: ["amex-gold", "capital-one-venture"] });
  });

  test("two users receive isolated wallets, journey entries, and preferences", async () => {
    const first = await signUpRewardlyUser({
      email: "first@example.com",
      password: "secure-password",
    });
    const second = await signUpRewardlyUser({
      email: "second@example.com",
      password: "secure-password",
    });

    await replaceCloudWallet(first.user.userId, { cardSlugs: ["amex-gold"] });
    await replaceCloudWallet(second.user.userId, { cardSlugs: ["capital-one-venture"] });
    await createPaymentJourney(first.user.userId, {
      merchant: "Amazon",
      amount: 50,
      selectedCard: "American Express Gold",
    });
    await updatePreferences(first.user.userId, {
      favoriteMerchants: [{ name: "Amazon" }],
    });

    expect(await getCloudWallet(first.user.userId)).toMatchObject({ cardSlugs: ["amex-gold"] });
    expect(await getCloudWallet(second.user.userId)).toMatchObject({
      cardSlugs: ["capital-one-venture"],
    });
    expect(preferences.docs.find((doc) => doc.userId === second.user.userId)?.favoriteMerchants)
      .toEqual([]);
  });

  test("local data migration is idempotent and reports partial failures", async () => {
    const { user } = await signUpRewardlyUser({
      email: "migrate@example.com",
      password: "secure-password",
    });

    const result = await migrateLocalData(user.userId, {
      wallet: { cardSlugs: ["amex-gold"] },
      paymentJourney: [
        { paymentId: "payment-1", merchant: "Amazon", amount: 12 },
        { paymentId: "bad-entry", merchant: "", amount: 0 },
      ],
      favorites: [{ name: "Target" }],
    });

    expect(result.results.wallet.imported).toBe(1);
    expect(result.results.paymentJourney.imported).toBe(1);
    expect(result.results.paymentJourney.skipped).toBe(1);
    expect(result.results.preferences.imported).toBe(1);
  });

  test("account deletion soft-deletes user data and revokes sessions", async () => {
    const session = await signUpRewardlyUser({
      email: "delete@example.com",
      password: "secure-password",
    });
    await replaceCloudWallet(session.user.userId, { cardSlugs: ["amex-gold"] });

    await deleteRewardlyAccount({
      userId: session.user.userId,
      email: session.user.email,
      authProviderUserId: session.user.userId,
      requestId: "req_delete",
    });

    expect(users.docs[0].deletedAt).toBeInstanceOf(Date);
    expect(sessions.docs[0].revokedAt).toBeInstanceOf(Date);
    expect(wallets.docs[0].deletedAt).toBeInstanceOf(Date);
  });

  test("privacy log redaction removes credentials and personal identifiers", () => {
    expect(
      redactForLog({
        email: "person@example.com",
        authorization: "Bearer token",
        nested: { refreshToken: "secret", safe: "merchant_detected" },
      }),
    ).toEqual({
      email: "[REDACTED]",
      authorization: "[REDACTED]",
      nested: { refreshToken: "[REDACTED]", safe: "merchant_detected" },
    });
  });
});

function memoryCollection(seed: any[] = []) {
  const docs = seed.map(clone);
  return {
    docs,
    findOne: jest.fn(async (query: any) => docs.find((doc) => matches(doc, query)) || null),
    insertOne: jest.fn(async (doc: any) => {
      docs.push(doc);
      return { insertedId: doc._id || doc.userId || doc.paymentId || docs.length };
    }),
    updateOne: jest.fn(async (query: any, update: any, options: any = {}) => {
      const index = docs.findIndex((doc) => matches(doc, query));
      if (index === -1) {
        if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        const inserted = { ...query, ...(update.$setOnInsert || {}), ...(update.$set || {}) };
        docs.push(inserted);
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
        sort: () => ({
          limit: () => ({ toArray: async () => found }),
          toArray: async () => found,
        }),
        limit: () => ({ toArray: async () => found }),
        toArray: async () => found,
      };
    }),
  };
}

function matches(doc: any, query: any) {
  return Object.entries(query || {}).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const expression = expected as any;
      if ("$in" in expression) return expression.$in.includes(actual);
      if ("$ne" in expression) return actual !== expression.$ne;
    }
    if (key === "slug" && expected && typeof expected === "object" && "$in" in expected) {
      return (expected as any).$in.includes(actual);
    }
    return actual === expected;
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
