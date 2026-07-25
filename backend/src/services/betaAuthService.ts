import crypto from "crypto";
import type { Collection } from "mongodb";
import {
  getBetaExtensionConnectionsCollection,
  getBetaUsersCollection,
  getBetaWalletsCollection,
  getCardsCollection,
  type BetaUser,
  type BetaWallet,
} from "../db";

export type AuthenticatedBetaUser = {
  userId: string;
  name?: string;
  email?: string;
  status: "active";
};

export type CreateBetaUserInput = {
  name?: string;
  email?: string;
  tokenExpiresAt?: Date | null;
};

export type CreatedBetaUser = {
  user: BetaUser;
  activationToken: string;
};

const TOKEN_BYTES = 32;
const CONNECTION_CODE_BYTES = 18;
const CONNECTION_CODE_TTL_MS = 5 * 60 * 1000;

export class BetaAuthenticationError extends Error {
  status = 401;
}

export class BetaAuthorizationError extends Error {
  status = 403;
}

export class BetaValidationError extends Error {
  status = 400;
}

export async function createBetaUser(
  input: CreateBetaUserInput,
): Promise<CreatedBetaUser> {
  const users = await getBetaUsersCollection();
  const wallets = await getBetaWalletsCollection();
  const now = new Date();
  const activationToken = generateToken();
  const user: BetaUser = {
    userId: `beta_${crypto.randomUUID()}`,
    name: cleanOptional(input.name),
    email: cleanOptional(input.email)?.toLowerCase(),
    status: "invited",
    activationTokenHash: hashToken(activationToken),
    sessionTokenHash: null,
    tokenExpiresAt: input.tokenExpiresAt || null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };

  await users.insertOne(user);
  await wallets.updateOne(
    { userId: user.userId },
    {
      $setOnInsert: {
        userId: user.userId,
        cardSlugs: [],
        onboardingCompletedAt: null,
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true },
  );

  return { user, activationToken };
}

export async function activateBetaUser(activationToken: string) {
  const users = await getBetaUsersCollection();
  const tokenHash = hashToken(activationToken);
  const user = await users.findOne({ activationTokenHash: tokenHash });
  assertUsableInvite(user);

  const sessionToken = generateToken();
  const now = new Date();
  await users.updateOne(
    { userId: user.userId },
    {
      $set: {
        status: "active",
        sessionTokenHash: hashToken(sessionToken),
        activationTokenHash: null,
        updatedAt: now,
        lastUsedAt: now,
      },
    },
  );

  return {
    sessionToken,
    user: publicBetaUser({ ...user, status: "active", lastUsedAt: now }),
  };
}

export async function authenticateBetaToken(
  authorizationHeader?: string,
): Promise<AuthenticatedBetaUser> {
  const token = bearerToken(authorizationHeader);
  if (!token) {
    throw new BetaAuthenticationError("Rewardly beta access is required.");
  }

  const users = await getBetaUsersCollection();
  const user = await users.findOne({ sessionTokenHash: hashToken(token) });
  if (!user || user.status !== "active") {
    throw new BetaAuthenticationError("Rewardly beta access is required.");
  }
  if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() <= Date.now()) {
    throw new BetaAuthenticationError("Rewardly beta access is required.");
  }

  const now = new Date();
  await users.updateOne(
    { userId: user.userId },
    { $set: { lastUsedAt: now, updatedAt: now } },
  );
  return publicBetaUser({ ...user, lastUsedAt: now });
}

export async function revokeBetaUser(userId: string) {
  const users = await getBetaUsersCollection();
  const now = new Date();
  const result = await users.updateOne(
    { userId },
    {
      $set: {
        status: "revoked",
        sessionTokenHash: null,
        activationTokenHash: null,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount > 0;
}

export async function rotateBetaSessionToken(userId: string) {
  const users = await getBetaUsersCollection();
  const user = await users.findOne({ userId });
  if (!user || user.status === "revoked") {
    throw new BetaAuthorizationError("Beta user is not active.");
  }

  const sessionToken = generateToken();
  const now = new Date();
  await users.updateOne(
    { userId },
    {
      $set: {
        status: "active",
        sessionTokenHash: hashToken(sessionToken),
        activationTokenHash: null,
        updatedAt: now,
      },
    },
  );
  return sessionToken;
}

export async function deleteBetaUser(userId: string) {
  const users = await getBetaUsersCollection();
  const wallets = await getBetaWalletsCollection();
  const [userResult, walletResult] = await Promise.all([
    users.deleteOne({ userId }),
    wallets.deleteOne({ userId }),
  ]);
  return {
    deletedUser: userResult.deletedCount > 0,
    deletedWallet: walletResult.deletedCount > 0,
  };
}

export async function listBetaUsers() {
  const users = await getBetaUsersCollection();
  return users
    .find(
      {},
      {
        projection: {
          _id: 0,
          sessionTokenHash: 0,
          activationTokenHash: 0,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getBetaWallet(userId: string): Promise<BetaWallet> {
  const wallets = await getBetaWalletsCollection();
  const now = new Date();
  const existing = await wallets.findOne({ userId });
  if (existing) return existing;

  const wallet: BetaWallet = {
    userId,
    cardSlugs: [],
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await wallets.insertOne(wallet);
  return wallet;
}

export async function setBetaWalletCards(userId: string, cardSlugs: string[]) {
  const wallets = await getBetaWalletsCollection();
  const now = new Date();
  const normalized = await validateWalletCardSlugs(cardSlugs);
  await wallets.updateOne(
    { userId },
    {
      $set: {
        cardSlugs: normalized,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        createdAt: now,
        onboardingCompletedAt: null,
      },
    },
    { upsert: true },
  );
  return getBetaWallet(userId);
}

export async function createExtensionConnection(userId: string) {
  const connections = await getBetaExtensionConnectionsCollection();
  const now = new Date();
  const connectionCode = generateConnectionCode();
  const connection = {
    connectionId: `conn_${crypto.randomUUID()}`,
    userId,
    codeHash: hashToken(connectionCode),
    status: "pending" as const,
    expiresAt: new Date(now.getTime() + CONNECTION_CODE_TTL_MS),
    redeemedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await connections.insertOne(connection);
  return {
    connectionCode,
    expiresAt: connection.expiresAt,
  };
}

export async function redeemExtensionConnection(connectionCode: string) {
  const connections = await getBetaExtensionConnectionsCollection();
  const users = await getBetaUsersCollection();
  const now = new Date();
  const codeHash = hashToken(connectionCode);
  const connection = await connections.findOne({ codeHash });
  if (
    !connection ||
    connection.status !== "pending" ||
    connection.expiresAt.getTime() <= now.getTime()
  ) {
    throw new BetaAuthenticationError("Rewardly extension connection is invalid.");
  }

  const user = await users.findOne({ userId: connection.userId });
  if (!user || user.status !== "active") {
    throw new BetaAuthenticationError("Rewardly extension connection is invalid.");
  }

  const sessionToken = generateToken();
  await Promise.all([
    connections.updateOne(
      { connectionId: connection.connectionId, status: "pending" },
      {
        $set: {
          status: "redeemed",
          redeemedAt: now,
          updatedAt: now,
        },
      },
    ),
    users.updateOne(
      { userId: user.userId },
      {
        $set: {
          sessionTokenHash: hashToken(sessionToken),
          lastUsedAt: now,
          updatedAt: now,
        },
      },
    ),
  ]);

  return {
    sessionToken,
    user: publicBetaUser({ ...user, status: "active", lastUsedAt: now }),
  };
}

export async function completeBetaOnboarding(userId: string) {
  const wallets = await getBetaWalletsCollection();
  const now = new Date();
  await wallets.updateOne(
    { userId },
    {
      $set: {
        onboardingCompletedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        cardSlugs: [],
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return getBetaWallet(userId);
}

export async function ensureBetaIndexes() {
  const users = await getBetaUsersCollection();
  const wallets = await getBetaWalletsCollection();
  await Promise.all([
    users.createIndex({ userId: 1 }, { unique: true }),
    users.createIndex({ sessionTokenHash: 1 }, { sparse: true }),
    users.createIndex({ activationTokenHash: 1 }, { sparse: true }),
    users.createIndex({ status: 1, createdAt: -1 }),
    wallets.createIndex({ userId: 1 }, { unique: true }),
    (await getBetaExtensionConnectionsCollection()).createIndex(
      { connectionId: 1 },
      { unique: true },
    ),
    (await getBetaExtensionConnectionsCollection()).createIndex(
      { codeHash: 1 },
      { unique: true },
    ),
    (await getBetaExtensionConnectionsCollection()).createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ),
  ]);
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function bearerToken(header?: string) {
  const value = String(header || "").trim();
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function publicBetaUser(user: BetaUser): AuthenticatedBetaUser {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    status: "active",
  };
}

function assertUsableInvite(user: BetaUser | null): asserts user is BetaUser {
  if (!user || user.status === "revoked") {
    throw new BetaAuthenticationError("Rewardly beta invite is invalid.");
  }
  if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() <= Date.now()) {
    throw new BetaAuthenticationError("Rewardly beta invite is invalid.");
  }
}

function cleanOptional(value: unknown) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned || undefined;
}

function normalizeCardSlugs(cardSlugs: string[]) {
  return Array.from(
    new Set(
      cardSlugs
        .map((slug) => String(slug || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 30);
}

async function validateWalletCardSlugs(cardSlugs: string[]) {
  const normalized = normalizeCardSlugs(cardSlugs);
  if (normalized.length !== cardSlugs.filter(Boolean).length) {
    throw new BetaValidationError("Wallet contains duplicate or malformed cards.");
  }
  const cards = await getCardsCollection();
  const found = await cards
    .find(
      { slug: { $in: normalized } },
      { projection: { _id: 0, slug: 1 } },
    )
    .toArray();
  const valid = new Set(found.map((card: any) => String(card.slug)));
  const unknown = normalized.filter((slug) => !valid.has(slug));
  if (unknown.length) {
    throw new BetaValidationError("Wallet contains unsupported cards.");
  }
  return normalized;
}

function generateConnectionCode() {
  return crypto.randomBytes(CONNECTION_CODE_BYTES).toString("base64url");
}
