import crypto from "crypto";
import { promisify } from "util";
import {
  getPaymentJourneyCollection,
  getRewardlySessionsCollection,
  getRewardlyUsersCollection,
  getUserPreferencesCollection,
  getUserShoppingPlansCollection,
  getUserWalletsCollection,
  type RewardlySession,
  type RewardlyUser,
} from "../db";

export type AuthenticatedUserContext = {
  userId: string;
  authProviderUserId: string;
  email?: string;
  requestId: string;
};

export type PublicRewardlyUser = {
  userId: string;
  email: string;
  displayName: string | null;
  status: RewardlyUser["status"];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  onboardingCompletedAt: string | null;
  dataSchemaVersion: number;
};

export class AuthError extends Error {
  constructor(
    public status: number,
    public code:
      | "AUTHENTICATION_REQUIRED"
      | "INVALID_SESSION"
      | "SESSION_EXPIRED"
      | "ACCOUNT_SUSPENDED"
      | "VALIDATION_ERROR"
      | "CONFLICT",
    message: string,
    public retryable = false,
    public details?: unknown,
  ) {
    super(message);
  }
}

const TOKEN_BYTES = 32;
const ACCESS_TOKEN_TTL_MS = Number(process.env.REWARDLY_ACCESS_TOKEN_TTL_MS || 60 * 60 * 1000);
const REFRESH_TOKEN_TTL_MS = Number(process.env.REWARDLY_REFRESH_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000);
const PASSWORD_ITERATIONS = 120_000;
const SCHEMA_VERSION = 1;
const pbkdf2Async = promisify(crypto.pbkdf2);

export async function signUpRewardlyUser(body: any) {
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const displayName = cleanString(body?.displayName, 120);
  validateEmailPassword(email, password);

  const users = await getRewardlyUsersCollection();
  const existing = await users.findOne({ email, status: { $ne: "deleted" } } as any);
  if (existing) {
    throw new AuthError(409, "CONFLICT", "An account already exists for this email.");
  }

  const now = new Date();
  const salt = crypto.randomBytes(16).toString("base64url");
  const user: RewardlyUser = {
    userId: `usr_${crypto.randomUUID()}`,
    email,
    displayName: displayName || null,
    status: "active",
    authProvider: "rewardly_native",
    authProviderUserId: `rewardly_native:${email}`,
    passwordHash: await hashPassword(password, salt),
    passwordSalt: salt,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    dataSchemaVersion: SCHEMA_VERSION,
    deletedAt: null,
    onboardingCompletedAt: null,
  };
  await users.insertOne(user);
  await ensureDefaultUserData(user.userId, now);
  const session = await createSession(user.userId, now);
  return { user: publicUser(user), ...session };
}

export async function signInRewardlyUser(body: any) {
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const users = await getRewardlyUsersCollection();
  const user = await users.findOne({ email });
  if (!user || user.status === "deleted" || !user.passwordHash || !user.passwordSalt) {
    throw new AuthError(401, "INVALID_SESSION", "Email or password is incorrect.");
  }
  if (user.status === "suspended") {
    throw new AuthError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  }
  if (!(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
    throw new AuthError(401, "INVALID_SESSION", "Email or password is incorrect.");
  }

  const now = new Date();
  await users.updateOne({ userId: user.userId }, { $set: { lastLoginAt: now, updatedAt: now } });
  await ensureDefaultUserData(user.userId, now);
  const session = await createSession(user.userId, now);
  return { user: publicUser({ ...user, lastLoginAt: now, updatedAt: now }), ...session };
}

export async function refreshRewardlySession(refreshToken: string) {
  const token = cleanString(refreshToken, 500);
  if (!token) throw new AuthError(401, "AUTHENTICATION_REQUIRED", "Sign in is required.");
  const sessions = await getRewardlySessionsCollection();
  const session = await sessions.findOne({ refreshTokenHash: hashToken(token), status: "active" });
  if (!session) throw new AuthError(401, "INVALID_SESSION", "Session is invalid.");
  const now = new Date();
  if (session.refreshExpiresAt.getTime() <= now.getTime()) {
    await sessions.updateOne(
      { sessionId: session.sessionId },
      { $set: { status: "revoked", revokedAt: now, updatedAt: now } },
    );
    throw new AuthError(401, "SESSION_EXPIRED", "Session expired.");
  }
  const users = await getRewardlyUsersCollection();
  const user = await users.findOne({ userId: session.userId });
  assertUsableUser(user);
  await sessions.updateOne(
    { sessionId: session.sessionId },
    { $set: { status: "revoked", revokedAt: now, updatedAt: now } },
  );
  const next = await createSession(user.userId, now);
  return { user: publicUser(user), ...next };
}

export async function authenticateAccessToken(authorizationHeader?: string, requestId = createRequestId()) {
  const token = bearerToken(authorizationHeader);
  if (!token) {
    throw new AuthError(401, "AUTHENTICATION_REQUIRED", "Sign in is required.");
  }
  const sessions = await getRewardlySessionsCollection();
  const session = await sessions.findOne({ accessTokenHash: hashToken(token), status: "active" });
  if (!session) throw new AuthError(401, "INVALID_SESSION", "Session is invalid.");
  const now = new Date();
  if (session.expiresAt.getTime() <= now.getTime()) {
    throw new AuthError(401, "SESSION_EXPIRED", "Session expired.");
  }
  const users = await getRewardlyUsersCollection();
  const user = await users.findOne({ userId: session.userId });
  assertUsableUser(user);
  return {
    userId: user.userId,
    authProviderUserId: user.authProviderUserId,
    email: user.email,
    requestId,
  } satisfies AuthenticatedUserContext;
}

export async function logoutRewardlySession(refreshToken?: string, authorizationHeader?: string) {
  const hashes = [bearerToken(authorizationHeader), cleanString(refreshToken, 500)]
    .filter(Boolean)
    .map(hashToken);
  if (!hashes.length) return { revoked: false };
  const sessions = await getRewardlySessionsCollection();
  const now = new Date();
  const result = await sessions.updateMany(
    { $or: [{ accessTokenHash: { $in: hashes } }, { refreshTokenHash: { $in: hashes } }] },
    { $set: { status: "revoked", revokedAt: now, updatedAt: now } },
  );
  return { revoked: result.modifiedCount > 0 };
}

export async function deleteRewardlyAccount(context: AuthenticatedUserContext) {
  const users = await getRewardlyUsersCollection();
  const sessions = await getRewardlySessionsCollection();
  const now = new Date();
  const deletedEmail = `deleted+${context.userId}+${now.getTime()}@deleted.rewardly.local`;
  await Promise.all([
    users.updateOne(
      { userId: context.userId },
      {
        $set: {
          status: "deleted",
          email: deletedEmail,
          authProviderUserId: `deleted:${context.userId}:${now.getTime()}`,
          deletedAt: now,
          updatedAt: now,
          passwordHash: null,
          passwordSalt: null,
        },
      },
    ),
    sessions.updateMany(
      { userId: context.userId },
      { $set: { status: "revoked", revokedAt: now, updatedAt: now } },
    ),
    getUserWalletsCollection().then((collection) =>
      collection.updateOne({ userId: context.userId }, { $set: { deletedAt: now, updatedAt: now } }),
    ),
    getPaymentJourneyCollection().then((collection) =>
      collection.updateMany({ userId: context.userId }, { $set: { deletedAt: now, updatedAt: now } }),
    ),
    getUserShoppingPlansCollection().then((collection) =>
      collection.updateMany({ userId: context.userId }, { $set: { deletedAt: now, updatedAt: now } }),
    ),
    getUserPreferencesCollection().then((collection) =>
      collection.updateOne({ userId: context.userId }, { $set: { deletedAt: now, updatedAt: now } }),
    ),
  ]);
  return { deleted: true };
}

export async function ensureProductionAuthIndexes() {
  const [users, sessions] = await Promise.all([
    getRewardlyUsersCollection(),
    getRewardlySessionsCollection(),
  ]);
  await Promise.all([
    users.createIndex({ userId: 1 }, { unique: true }),
    users.createIndex(
      { email: 1 },
      { unique: true, partialFilterExpression: { status: { $in: ["active", "suspended"] } } },
    ),
    users.createIndex(
      { authProviderUserId: 1 },
      { unique: true, partialFilterExpression: { status: { $in: ["active", "suspended"] } } },
    ),
    users.createIndex({ status: 1, createdAt: -1 }),
    sessions.createIndex({ sessionId: 1 }, { unique: true }),
    sessions.createIndex({ userId: 1, status: 1 }),
    sessions.createIndex({ accessTokenHash: 1 }, { unique: true }),
    sessions.createIndex({ refreshTokenHash: 1 }, { unique: true }),
    sessions.createIndex({ refreshExpiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export function createRequestId() {
  return `req_${crypto.randomUUID()}`;
}

export function publicUser(user: RewardlyUser): PublicRewardlyUser {
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName || null,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() || null,
    dataSchemaVersion: user.dataSchemaVersion,
  };
}

function assertUsableUser(user: RewardlyUser | null): asserts user is RewardlyUser {
  if (!user || user.status === "deleted") {
    throw new AuthError(401, "INVALID_SESSION", "Session is invalid.");
  }
  if (user.status === "suspended") {
    throw new AuthError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  }
}

async function createSession(userId: string, now: Date) {
  const sessions = await getRewardlySessionsCollection();
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const session: RewardlySession = {
    sessionId: `sess_${crypto.randomUUID()}`,
    userId,
    accessTokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    status: "active",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    revokedAt: null,
  };
  await sessions.insertOne(session);
  return {
    accessToken,
    refreshToken,
    expiresAt: session.expiresAt.toISOString(),
    refreshExpiresAt: session.refreshExpiresAt.toISOString(),
  };
}

async function ensureDefaultUserData(userId: string, now: Date) {
  const [wallets, prefs] = await Promise.all([
    getUserWalletsCollection(),
    getUserPreferencesCollection(),
  ]);
  await Promise.all([
    wallets.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          cardSlugs: [],
          createdAt: now,
          schemaVersion: SCHEMA_VERSION,
          syncRevision: 0,
          deletedAt: null,
          lastModifiedSource: "auth_signup",
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    ),
    prefs.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          favoriteMerchants: [],
          theme: "system",
          defaultCurrency: "USD",
          onboardingCompleted: false,
          locationEnabled: false,
          createdAt: now,
          schemaVersion: SCHEMA_VERSION,
          syncRevision: 0,
          deletedAt: null,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    ),
  ]);
}

function validateEmailPassword(email: string, password: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AuthError(400, "VALIDATION_ERROR", "A valid email is required.");
  }
  if (password.length < 10) {
    throw new AuthError(400, "VALIDATION_ERROR", "Password must be at least 10 characters.");
  }
}

async function hashPassword(password: string, salt: string) {
  const derived = await pbkdf2Async(password, salt, PASSWORD_ITERATIONS, 32, "sha256");
  return derived.toString("base64url");
}

async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = await hashPassword(password, salt);
  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(actualHash);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function bearerToken(header?: string) {
  const match = String(header || "").trim().match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanString(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
