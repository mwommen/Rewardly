jest.mock("../src/db", () => ({
  getBetaExtensionConnectionsCollection: jest.fn(),
  getBetaUsersCollection: jest.fn(),
  getBetaWalletsCollection: jest.fn(),
  getCardsCollection: jest.fn(),
}));

import {
  activateBetaUser,
  authenticateBetaToken,
  createExtensionConnection,
  createBetaUser,
  getBetaWallet,
  redeemExtensionConnection,
  revokeBetaUser,
  setBetaWalletCards,
} from "../src/services/betaAuthService";
import {
  getBetaExtensionConnectionsCollection,
  getBetaUsersCollection,
  getBetaWalletsCollection,
  getCardsCollection,
} from "../src/db";

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

function memoryCollection(seed: any[] = []) {
  const docs = seed;
  return {
    docs,
    insertOne: jest.fn(async (doc: any) => {
      docs.push({ ...doc });
      return { insertedId: doc.userId };
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
      return { modifiedCount: doc ? 1 : 0 };
    }),
    deleteOne: jest.fn(async (filter: any) => {
      const index = docs.findIndex((doc) =>
        Object.entries(filter).every(([key, value]) => doc[key] === value),
      );
      if (index >= 0) docs.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    }),
    find: jest.fn(() => ({
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(async () =>
        docs.map(({ activationTokenHash, sessionTokenHash, ...doc }) => doc),
      ),
    })),
    createIndex: jest.fn(async () => "index"),
  } as any;
}

describe("betaAuthService", () => {
  beforeEach(() => {
    const users = memoryCollection();
    const wallets = memoryCollection();
    const connections = memoryCollection();
    const cards = memoryCollection([
      { slug: "amex-gold" },
      { slug: "chase-sapphire-preferred" },
      { slug: "capital-one-venture" },
    ]);
    mockedUsers.mockResolvedValue(users);
    mockedWallets.mockResolvedValue(wallets);
    mockedConnections.mockResolvedValue(connections);
    mockedCards.mockResolvedValue(cards);
  });

  test("creates an invited beta user with a hashed activation token", async () => {
    const { user, activationToken } = await createBetaUser({
      name: "Tester",
      email: "Tester@Example.com",
    });
    const users = await mockedUsers.mock.results[0].value;

    expect(user.status).toBe("invited");
    expect(activationToken).toHaveLength(43);
    expect(users.docs[0].activationTokenHash).not.toBe(activationToken);
    expect(users.docs[0].email).toBe("tester@example.com");
  });

  test("activates an invite and authenticates the bearer session token", async () => {
    const { activationToken } = await createBetaUser({ name: "Tester" });
    const activated = await activateBetaUser(activationToken);
    const authenticated = await authenticateBetaToken(
      `Bearer ${activated.sessionToken}`,
    );

    expect(activated.user.status).toBe("active");
    expect(authenticated.userId).toBe(activated.user.userId);
  });

  test("keeps wallets isolated by authenticated user id", async () => {
    const userA = await activateBetaUser((await createBetaUser({})).activationToken);
    const userB = await activateBetaUser((await createBetaUser({})).activationToken);

    await setBetaWalletCards(userA.user.userId, ["amex-gold"]);
    await setBetaWalletCards(userB.user.userId, ["capital-one-venture"]);

    await expect(getBetaWallet(userA.user.userId)).resolves.toEqual(
      expect.objectContaining({ cardSlugs: ["amex-gold"] }),
    );
    await expect(getBetaWallet(userB.user.userId)).resolves.toEqual(
      expect.objectContaining({ cardSlugs: ["capital-one-venture"] }),
    );
  });

  test("rejects duplicate, malformed, and unknown wallet slugs", async () => {
    const user = await activateBetaUser((await createBetaUser({})).activationToken);

    await expect(
      setBetaWalletCards(user.user.userId, ["amex-gold", "AMEX-GOLD"]),
    ).rejects.toThrow(/duplicate|malformed/i);
    await expect(
      setBetaWalletCards(user.user.userId, ["unknown-card"]),
    ).rejects.toThrow(/unsupported/i);
    await expect(
      setBetaWalletCards(user.user.userId, ["amex-gold", "chase-sapphire-preferred"]),
    ).resolves.toEqual(
      expect.objectContaining({
        cardSlugs: ["amex-gold", "chase-sapphire-preferred"],
      }),
    );
  });

  test("creates and redeems a one-time extension connection code", async () => {
    const activated = await activateBetaUser((await createBetaUser({})).activationToken);
    const connection = await createExtensionConnection(activated.user.userId);
    const redeemed = await redeemExtensionConnection(connection.connectionCode);

    expect(connection.connectionCode).toBeTruthy();
    expect(redeemed.user.userId).toBe(activated.user.userId);
    await expect(
      redeemExtensionConnection(connection.connectionCode),
    ).rejects.toThrow(/extension connection/i);
  });

  test("revoked users cannot authenticate", async () => {
    const { activationToken } = await createBetaUser({ name: "Tester" });
    const activated = await activateBetaUser(activationToken);
    await revokeBetaUser(activated.user.userId);

    await expect(
      authenticateBetaToken(`Bearer ${activated.sessionToken}`),
    ).rejects.toThrow(/beta access/i);
  });
});
