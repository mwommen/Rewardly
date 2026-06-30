// backend/src/db.ts
import { MongoClient, Collection, Db, Document } from "mongodb";
import type { BenefitsPayload } from "./models/benefits";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const mongoServerSelectionTimeoutMS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000);
const mongoConnectTimeoutMS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 5000);
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
    console.log("✅ Connected to MongoDB at URI:", uri);
  }
  const db = client.db("creditCardOptimizer");
  console.log("Using database:", db.databaseName);
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

export async function getLinkedAccountsCollection(): Promise<Collection<LinkedAccount>> {
  const db = await connectDB();
  return db.collection<LinkedAccount>("linkedAccounts");
}

export async function getUserBenefitStatesCollection(): Promise<Collection<UserBenefitState>> {
  const db = await connectDB();
  return db.collection<UserBenefitState>("userBenefitStates");
}

export async function getAnalyticsCollection(): Promise<Collection<Document>> {
  const db = await connectDB();
  return db.collection<Document>("analyticsEvents");
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
