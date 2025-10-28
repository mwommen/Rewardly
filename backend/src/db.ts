// backend/src/db.ts
import { MongoClient, Collection, Db } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
let client: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * Connects to MongoDB and returns the DB instance.
 */
export async function connectDB(): Promise<Db> {
  if (cachedDb) return cachedDb;
  if (!client) {
    client = new MongoClient(uri);
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

/**
 * Type Definitions
 */
export interface Card {
  name: string;
  benefits?: Record<string, number>;
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
