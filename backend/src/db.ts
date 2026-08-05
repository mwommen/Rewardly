// backend/src/db.ts
import { MongoClient, Collection, Db, Document } from "mongodb";
import type { BenefitsPayload } from "./models/benefits";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const mongoServerSelectionTimeoutMS = Number(
  process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000,
);
const mongoConnectTimeoutMS = Number(
  process.env.MONGO_CONNECT_TIMEOUT_MS || 5000,
);
let client: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * Connects to MongoDB and returns the DB instance.
 */
export async function connectDB(): Promise<Db> {
  if (cachedDb) return cachedDb;
  if (!client) {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: mongoServerSelectionTimeoutMS,
      connectTimeoutMS: mongoConnectTimeoutMS,
    });
    await client.connect();
    console.log("Connected to MongoDB");
  }
  const db = client.db("creditCardOptimizer");
  cachedDb = db;
  return db;
}

/**
 * Alias for connectDB() used by other services.
 */
export async function getDb(): Promise<Db> {
  return connectDB();
}

/**
 * Collection helpers
 */
export async function getCardsCollection(): Promise<Collection<Card>> {
  const db = await connectDB();
  return db.collection<Card>("cards");
}

export async function getLinkedAccountsCollection(): Promise<
  Collection<LinkedAccount>
> {
  const db = await connectDB();
  return db.collection<LinkedAccount>("linkedAccounts");
}

export async function getUserBenefitStatesCollection(): Promise<
  Collection<UserBenefitState>
> {
  const db = await connectDB();
  return db.collection<UserBenefitState>("userBenefitStates");
}

export async function getAnalyticsCollection(): Promise<Collection<Document>> {
  const db = await connectDB();
  return db.collection<Document>("analyticsEvents");
}

export async function getFeedbackCollection(): Promise<Collection<Document>> {
  const db = await connectDB();
  return db.collection<Document>("feedbackEvents");
}

export async function getBetaUsersCollection(): Promise<Collection<BetaUser>> {
  const db = await connectDB();
  return db.collection<BetaUser>("betaUsers");
}

export async function getBetaWalletsCollection(): Promise<
  Collection<BetaWallet>
> {
  const db = await connectDB();
  return db.collection<BetaWallet>("betaWallets");
}

export async function getBetaExtensionConnectionsCollection(): Promise<
  Collection<BetaExtensionConnection>
> {
  const db = await connectDB();
  return db.collection<BetaExtensionConnection>("betaExtensionConnections");
}

export async function getRewardlyUsersCollection(): Promise<
  Collection<RewardlyUser>
> {
  const db = await connectDB();
  return db.collection<RewardlyUser>("rewardlyUsers");
}

export async function getRewardlySessionsCollection(): Promise<
  Collection<RewardlySession>
> {
  const db = await connectDB();
  return db.collection<RewardlySession>("rewardlySessions");
}

export async function getUserWalletsCollection(): Promise<
  Collection<UserWallet>
> {
  const db = await connectDB();
  return db.collection<UserWallet>("userWallets");
}

export async function getPaymentJourneyCollection(): Promise<
  Collection<PaymentJourneyRecord>
> {
  const db = await connectDB();
  return db.collection<PaymentJourneyRecord>("paymentJourney");
}

export async function getUserShoppingPlansCollection(): Promise<
  Collection<UserShoppingPlanRecord>
> {
  const db = await connectDB();
  return db.collection<UserShoppingPlanRecord>("userShoppingPlans");
}

export async function getUserPreferencesCollection(): Promise<
  Collection<UserPreferencesRecord>
> {
  const db = await connectDB();
  return db.collection<UserPreferencesRecord>("userPreferences");
}

export async function getDecisionTrustRecordsCollection(): Promise<
  Collection<DecisionTrustRecordDocument>
> {
  const db = await connectDB();
  return db.collection<DecisionTrustRecordDocument>("decisionTrustRecords");
}

export async function getDecisionInputSnapshotsCollection(): Promise<
  Collection<DecisionInputSnapshotDocument>
> {
  const db = await connectDB();
  return db.collection<DecisionInputSnapshotDocument>("decisionInputSnapshots");
}

export async function getPartnerOrganizationsCollection(): Promise<
  Collection<PartnerOrganization>
> {
  const db = await connectDB();
  return db.collection<PartnerOrganization>("partnerOrganizations");
}

export async function getPartnerProjectsCollection(): Promise<
  Collection<PartnerProject>
> {
  const db = await connectDB();
  return db.collection<PartnerProject>("partnerProjects");
}

export async function getPartnerApiKeysCollection(): Promise<
  Collection<PartnerApiKey>
> {
  const db = await connectDB();
  return db.collection<PartnerApiKey>("partnerApiKeys");
}

export async function getPartnerUsageCollection(): Promise<
  Collection<PartnerUsageRecord>
> {
  const db = await connectDB();
  return db.collection<PartnerUsageRecord>("partnerUsageRecords");
}

/**
 * Type Definitions
 */
export interface Card {
  name: string;
  benefits?: Record<string, number>;
  benefitsDetail?: BenefitsPayload;
  perks?: string[];
  slug?: string;
  issuer?: string;
  rewardsByCategory?: Record<string, number>;
  annualFee?: number;
  confidence?: number;
  sourceUrl?: string;
  sourceType?: string;
  lastVerified?: string;
  productionEligible?: boolean;
}

export interface LinkedAccount {
  userId: string;
  itemId: string;
  accessToken: string;
  institution?: { id?: string; name?: string };
  accounts?: {
    accountId: string;
    mask?: string;
    name?: string;
    official_name?: string;
    type?: string;
    subtype?: string;
    mappedCardSlug?: string;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserBenefitState {
  userId: string;
  benefitKey: string;
  walletBenefitStateId?: string;
  cardId?: string;
  benefitId?: string;
  issuer?: string;
  status?: string;
  enrollmentStatus?: string;
  activationStatus?: string;
  benefitState?: string;
  remainingValue?: number;
  remainingSpendCap?: number;
  remainingUses?: number;
  currentSpend?: number;
  benefitUsageCount?: number;
  currentCycle?: string;
  historicalCycles?: unknown[];
  lastUsed?: Date | null;
  effectiveDate?: Date | null;
  resetDate?: Date | null;
  expirationDate?: Date | null;
  lastObserved?: Date | null;
  lastVerified?: Date | null;
  confidence?: number;
  confidenceSource?: string;
  notes?: string[];
  events?: unknown[];
  cardSlug?: string;
  cardName?: string;
  label?: string;
  period?: string;
  amountUSD?: number;
  requiresEnrollment?: boolean;
  enrolled?: boolean;
  enrolledAt?: Date | null;
  usedAt?: Date | null;
  remindEnabled?: boolean;
  updatedAt?: Date;
}

export interface BetaUser {
  userId: string;
  name?: string;
  email?: string;
  status: "invited" | "active" | "revoked";
  activationTokenHash?: string | null;
  sessionTokenHash?: string | null;
  tokenExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date | null;
}

export interface BetaWallet {
  userId: string;
  cardSlugs: string[];
  onboardingCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BetaExtensionConnection {
  connectionId: string;
  userId: string;
  codeHash: string;
  status: "pending" | "redeemed" | "expired" | "revoked";
  expiresAt: Date;
  redeemedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RewardlyUser {
  userId: string;
  email: string;
  displayName?: string | null;
  status: "active" | "suspended" | "deleted";
  authProvider: "rewardly_native";
  authProviderUserId: string;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
  dataSchemaVersion: number;
  deletedAt?: Date | null;
  onboardingCompletedAt?: Date | null;
}

export interface RewardlySession {
  sessionId: string;
  userId: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  status: "active" | "revoked";
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  refreshExpiresAt: Date;
  revokedAt?: Date | null;
}

export interface UserWallet {
  userId: string;
  cardSlugs: string[];
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
  syncRevision: number;
  deletedAt?: Date | null;
  lastModifiedSource?: string | null;
}

export interface PaymentJourneyRecord {
  paymentId: string;
  userId: string;
  decisionId?: string | null;
  merchant: string;
  amount: number;
  currency: "USD";
  recommendedCard?: string | null;
  selectedCard?: string | null;
  estimatedValue?: number | null;
  confidence?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  schemaVersion: number;
  syncRevision: number;
  deletedAt?: Date | null;
  clientIdempotencyKey?: string | null;
  lastModifiedSource?: string | null;
}

export interface UserShoppingPlanRecord {
  planId: string;
  userId: string;
  title: string;
  notes?: string | null;
  status: "active" | "completed";
  currency: "USD";
  items: unknown[];
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
  syncRevision: number;
  deletedAt?: Date | null;
  lastModifiedSource?: string | null;
}

export interface UserPreferencesRecord {
  userId: string;
  favoriteMerchants: Array<{
    name: string;
    category?: string;
    domain?: string;
    merchantId?: string;
  }>;
  theme?: "system" | "light" | "dark";
  defaultCurrency: "USD";
  onboardingCompleted: boolean;
  locationEnabled?: boolean;
  contextPreferences?: unknown[];
  contextConstraints?: unknown[];
  decisionPolicy?: unknown;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
  syncRevision: number;
  deletedAt?: Date | null;
}

export interface DecisionTrustRecordDocument {
  trustRecordId: string;
  decisionId: string;
  ownerUserId: string | null;
  tenantId: string | null;
  trustRecord: unknown;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
}

export interface DecisionInputSnapshotDocument {
  inputSnapshotId: string;
  decisionId: string;
  ownerUserId: string | null;
  tenantId: string | null;
  snapshot: unknown;
  retainedFields: Array<{
    field: string;
    reason: string;
  }>;
  createdAt: Date;
  schemaVersion: number;
}

export interface PartnerOrganization {
  organizationId: string;
  displayName: string;
  status: "active" | "suspended" | "deleted";
  metadata: Record<string, string | number | boolean | null>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  schemaVersion: number;
}

export interface PartnerProject {
  projectId: string;
  organizationId: string;
  displayName: string;
  environment: "live" | "test" | "sandbox" | "development";
  status: "active" | "suspended" | "deleted";
  configuration: Record<string, string | number | boolean | null>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  schemaVersion: number;
}

export interface PartnerApiKey {
  apiKeyId: string;
  organizationId: string;
  projectId: string;
  environment: PartnerProject["environment"];
  keyPrefix: "rw_live" | "rw_test";
  keyHash: string;
  keyPreview: string;
  scopes: string[];
  status: "active" | "revoked" | "expired";
  metadata: Record<string, string | number | boolean | null>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
  lastRotatedAt?: Date | null;
  schemaVersion: number;
}

export interface PartnerUsageRecord {
  usageRecordId: string;
  organizationId: string;
  projectId: string;
  environment: PartnerProject["environment"];
  apiKeyId: string;
  requestId: string;
  correlationId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  requestCount: number;
  decisionCount: number;
  replayCount: number;
  errorCount: number;
  rateLimitViolationCount: number;
  latencyMs: number;
  createdAt: Date;
  schemaVersion: number;
}
