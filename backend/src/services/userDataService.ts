import crypto from "crypto";
import {
  getCardsCollection,
  getPaymentJourneyCollection,
  getUserPreferencesCollection,
  getUserShoppingPlansCollection,
  getUserWalletsCollection,
  type PaymentJourneyRecord,
  type UserPreferencesRecord,
  type UserShoppingPlanRecord,
  type UserWallet,
} from "../db";
import { decidePayment } from "./paymentDecisionService";
import { AuthError, type AuthenticatedUserContext } from "./productionAuthService";
import { toPlanningPaymentDecisionResponse } from "./planningService";

const SCHEMA_VERSION = 1;
const MAX_JOURNEY_LIMIT = 100;

export async function getCloudWallet(userId: string) {
  const wallets = await getUserWalletsCollection();
  const now = new Date();
  const existing = await wallets.findOne({ userId, deletedAt: { $in: [null, undefined] } } as any);
  if (existing) return publicWallet(existing);
  const wallet: UserWallet = {
    userId,
    cardSlugs: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    syncRevision: 0,
    deletedAt: null,
    lastModifiedSource: "server_default",
  };
  await wallets.insertOne(wallet);
  return publicWallet(wallet);
}

export async function replaceCloudWallet(userId: string, body: any, source = "mobile") {
  const cards = Array.isArray(body?.cardSlugs)
    ? body.cardSlugs
    : Array.isArray(body?.cards)
      ? body.cards.map((card: any) => card.cardId || card.cardSlug || card.slug)
      : null;
  if (!cards) throw validation("Card list is required.");
  const cardSlugs = await validateCardSlugs(cards);
  const wallets = await getUserWalletsCollection();
  const now = new Date();
  const current = await wallets.findOne({ userId });
  const wallet: UserWallet = {
    userId,
    cardSlugs,
    createdAt: current?.createdAt || now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    syncRevision: (current?.syncRevision || 0) + 1,
    deletedAt: null,
    lastModifiedSource: source,
  };
  await wallets.updateOne({ userId }, { $set: wallet }, { upsert: true });
  return publicWallet(wallet);
}

export async function addCloudWalletCard(userId: string, cardId: string) {
  const wallet = await getCloudWallet(userId);
  const next = Array.from(new Set([...wallet.cardSlugs, cardId]));
  if (next.length === wallet.cardSlugs.length) return wallet;
  return replaceCloudWallet(userId, { cardSlugs: next }, "mobile_add_card");
}

export async function removeCloudWalletCard(userId: string, cardId: string) {
  const wallet = await getCloudWallet(userId);
  return replaceCloudWallet(
    userId,
    { cardSlugs: wallet.cardSlugs.filter((slug) => slug !== normalizeCardSlug(cardId)) },
    "mobile_remove_card",
  );
}

export async function listPaymentJourney(userId: string, limit = 50) {
  const collection = await getPaymentJourneyCollection();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), MAX_JOURNEY_LIMIT);
  const records = await collection
    .find({ userId, deletedAt: { $in: [null, undefined] } } as any)
    .sort({ completedAt: -1, createdAt: -1 })
    .limit(safeLimit)
    .toArray();
  return records.map(publicPaymentJourney);
}

export async function createPaymentJourney(userId: string, body: any) {
  const collection = await getPaymentJourneyCollection();
  const now = new Date();
  const paymentId = cleanString(body?.paymentId, 90) || `pay_${crypto.randomUUID()}`;
  const clientIdempotencyKey = cleanString(body?.clientIdempotencyKey, 120) || null;
  if (clientIdempotencyKey) {
    const existing = await collection.findOne({ userId, clientIdempotencyKey, deletedAt: { $in: [null, undefined] } } as any);
    if (existing) return publicPaymentJourney(existing);
  }
  const merchant = cleanString(body?.merchant, 160);
  const amount = Number(body?.amount);
  if (!merchant) throw validation("merchant is required");
  if (!Number.isFinite(amount) || amount <= 0) throw validation("amount is required");
  const record: PaymentJourneyRecord = {
    paymentId,
    userId,
    decisionId: cleanString(body?.decisionId, 120) || null,
    merchant,
    amount,
    currency: "USD",
    recommendedCard: cleanString(body?.recommendedCard, 160) || null,
    selectedCard: cleanString(body?.selectedCard, 160) || null,
    estimatedValue: Number.isFinite(Number(body?.estimatedValue)) ? Number(body.estimatedValue) : null,
    confidence: Number.isFinite(Number(body?.confidence)) ? Number(body.confidence) : null,
    notes: sanitizeNotes(body?.notes),
    createdAt: now,
    updatedAt: now,
    completedAt: parseDate(body?.completedAt) || now,
    schemaVersion: SCHEMA_VERSION,
    syncRevision: 1,
    deletedAt: null,
    clientIdempotencyKey,
    lastModifiedSource: cleanString(body?.lastModifiedSource, 80) || "mobile",
  };
  await collection.insertOne(record);
  return publicPaymentJourney(record);
}

export async function getPaymentJourney(userId: string, paymentId: string) {
  const collection = await getPaymentJourneyCollection();
  const record = await collection.findOne({ userId, paymentId, deletedAt: { $in: [null, undefined] } } as any);
  return record ? publicPaymentJourney(record) : null;
}

export async function updatePaymentJourney(userId: string, paymentId: string, body: any) {
  const collection = await getPaymentJourneyCollection();
  const current = await collection.findOne({ userId, paymentId, deletedAt: { $in: [null, undefined] } } as any);
  if (!current) return null;
  const now = new Date();
  const patch = {
    notes: body?.notes === undefined ? current.notes : sanitizeNotes(body.notes),
    selectedCard: body?.selectedCard === undefined ? current.selectedCard : cleanString(body.selectedCard, 160) || null,
    updatedAt: now,
    syncRevision: (current.syncRevision || 0) + 1,
    lastModifiedSource: cleanString(body?.lastModifiedSource, 80) || "mobile",
  };
  await collection.updateOne({ userId, paymentId }, { $set: patch });
  return publicPaymentJourney({ ...current, ...patch });
}

export async function deletePaymentJourney(userId: string, paymentId: string) {
  const collection = await getPaymentJourneyCollection();
  const now = new Date();
  const result = await collection.updateOne(
    { userId, paymentId, deletedAt: { $in: [null, undefined] } } as any,
    { $set: { deletedAt: now, updatedAt: now } },
  );
  return result.modifiedCount > 0;
}

export async function listCloudPlans(userId: string) {
  const collection = await getUserShoppingPlansCollection();
  const plans = await collection
    .find({ userId, deletedAt: { $in: [null, undefined] } } as any)
    .sort({ updatedAt: -1 })
    .toArray();
  return plans.map(publicPlan);
}

export async function createCloudPlan(userId: string, body: any) {
  const collection = await getUserShoppingPlansCollection();
  const title = cleanString(body?.title, 120);
  if (!title) throw validation("title is required");
  const now = new Date();
  const plan: UserShoppingPlanRecord = {
    planId: `plan_${crypto.randomUUID()}`,
    userId,
    title,
    notes: cleanString(body?.notes, 500) || null,
    status: "active",
    currency: "USD",
    items: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    syncRevision: 1,
    deletedAt: null,
    lastModifiedSource: "mobile",
  };
  await collection.insertOne(plan);
  return publicPlan(plan);
}

export async function getCloudPlan(userId: string, planId: string) {
  const collection = await getUserShoppingPlansCollection();
  const plan = await collection.findOne({ userId, planId, deletedAt: { $in: [null, undefined] } } as any);
  return plan ? publicPlan(plan) : null;
}

export async function updateCloudPlan(userId: string, planId: string, body: any) {
  const collection = await getUserShoppingPlansCollection();
  const current = await collection.findOne({ userId, planId, deletedAt: { $in: [null, undefined] } } as any);
  if (!current) return null;
  const now = new Date();
  const patch: Partial<UserShoppingPlanRecord> = {
    title: body?.title === undefined ? current.title : cleanString(body.title, 120),
    notes: body?.notes === undefined ? current.notes : cleanString(body.notes, 500) || null,
    status: body?.status === undefined ? current.status : cleanString(body.status, 20) as any,
    updatedAt: now,
    syncRevision: (current.syncRevision || 0) + 1,
    lastModifiedSource: "mobile",
  };
  if (!patch.title) throw validation("title is required");
  if (patch.status !== "active" && patch.status !== "completed") throw validation("status must be active or completed");
  await collection.updateOne({ userId, planId }, { $set: patch });
  return publicPlan({ ...current, ...patch });
}

export async function deleteCloudPlan(userId: string, planId: string) {
  const collection = await getUserShoppingPlansCollection();
  const now = new Date();
  const result = await collection.updateOne(
    { userId, planId, deletedAt: { $in: [null, undefined] } } as any,
    { $set: { deletedAt: now, updatedAt: now } },
  );
  return result.modifiedCount > 0;
}

export async function addCloudPlanItem(userId: string, planId: string, body: any) {
  const collection = await getUserShoppingPlansCollection();
  const current = await collection.findOne({ userId, planId, deletedAt: { $in: [null, undefined] } } as any);
  if (!current) return null;
  const merchant = cleanString(body?.merchant?.name || body?.merchant, 160);
  const amount = Number(body?.purchase?.amount || body?.amount);
  if (!merchant) throw validation("merchant is required");
  if (!Number.isFinite(amount) || amount <= 0) throw validation("amount is required");
  const duplicate = (current.items as any[]).some((item) => item.merchant?.name === merchant && item.purchase?.amount === amount && item.completionState === "planned");
  if (duplicate) throw new AuthError(409, "CONFLICT", "plan already contains this planned merchant and amount");
  const now = new Date();
  const item = {
    itemId: `item_${crypto.randomUUID()}`,
    merchant: { name: merchant, category: cleanString(body?.merchant?.category, 120) || undefined, domain: cleanString(body?.merchant?.domain, 120) || undefined },
    purchase: { amount, currency: "USD" },
    notes: cleanString(body?.notes, 500) || undefined,
    completionState: "planned",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const items = [...(current.items as any[]), item];
  await collection.updateOne({ userId, planId }, { $set: { items, updatedAt: now, syncRevision: (current.syncRevision || 0) + 1 } });
  return item;
}

export async function completeCloudPlanItem(userId: string, planId: string, body: any) {
  const collection = await getUserShoppingPlansCollection();
  const current = await collection.findOne({ userId, planId, deletedAt: { $in: [null, undefined] } } as any);
  if (!current) return null;
  const itemId = cleanString(body?.itemId, 120);
  const now = new Date();
  const items = (current.items as any[]).map((item) =>
    item.itemId === itemId
      ? {
          ...item,
          completionState: "completed",
          completedAt: item.completedAt || now.toISOString(),
          completedDecisionId: cleanString(body?.decisionId, 120) || item.completedDecisionId,
          updatedAt: now.toISOString(),
        }
      : item,
  );
  if (JSON.stringify(items) === JSON.stringify(current.items)) return null;
  const completedItem = items.find((item) => item.itemId === itemId);
  await collection.updateOne(
    { userId, planId },
    {
      $set: {
        items,
        status: items.length && items.every((item) => item.completionState === "completed") ? "completed" : current.status,
        updatedAt: now,
        syncRevision: (current.syncRevision || 0) + 1,
      },
    },
  );
  if (completedItem) {
    await createPaymentJourney(userId, {
      clientIdempotencyKey: `plan:${planId}:${itemId}`,
      decisionId: completedItem.completedDecisionId,
      merchant: completedItem.merchant.name,
      amount: completedItem.purchase.amount,
      notes: completedItem.notes,
      lastModifiedSource: "plan_completion",
    });
  }
  return completedItem;
}

export async function optimizeCloudPlan(context: AuthenticatedUserContext, planId: string) {
  const plan = await getCloudPlan(context.userId, planId);
  if (!plan) return null;
  const wallet = await getCloudWallet(context.userId);
  const optimizedItems = [];
  for (const item of plan.items as any[]) {
    const decisionId = `pdec_${crypto.randomUUID()}`;
    const decision = await decidePayment({
      userId: context.userId,
      merchant: item.merchant.name,
      hostname: item.merchant.domain,
      category: item.merchant.category,
      amount: item.purchase.amount,
      manualCardSlugs: wallet.cardSlugs,
      restrictToWallet: true,
      purchaseContext: {
        surface: "backend",
        amount: item.purchase.amount,
        currency: "USD",
        checkoutDetected: false,
        checkoutStage: "payment",
      },
    });
    optimizedItems.push({
      itemId: item.itemId,
      merchant: item.merchant,
      purchase: item.purchase,
      completionState: item.completionState,
      decision: toPlanningPaymentDecisionResponse(decision, decisionId),
    });
  }
  return {
    planId: plan.planId,
    title: plan.title,
    currency: "USD",
    optimizedItems,
    estimatedTotalRewards: sumKnownRewards(optimizedItems),
  };
}

export async function getPreferences(userId: string) {
  const collection = await getUserPreferencesCollection();
  const now = new Date();
  const existing = await collection.findOne({ userId, deletedAt: { $in: [null, undefined] } } as any);
  if (existing) return publicPreferences(existing);
  const prefs: UserPreferencesRecord = {
    userId,
    favoriteMerchants: [],
    theme: "system",
    defaultCurrency: "USD",
    onboardingCompleted: false,
    locationEnabled: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    syncRevision: 0,
    deletedAt: null,
  };
  await collection.insertOne(prefs);
  return publicPreferences(prefs);
}

export async function updatePreferences(userId: string, body: any) {
  const collection = await getUserPreferencesCollection();
  const current = await getPreferences(userId);
  const now = new Date();
  const next = {
    favoriteMerchants: Array.isArray(body?.favoriteMerchants)
      ? body.favoriteMerchants.slice(0, 50).map(publicFavorite)
      : current.favoriteMerchants,
    theme: ["system", "light", "dark"].includes(body?.theme) ? body.theme : current.theme,
    defaultCurrency: "USD" as const,
    onboardingCompleted:
      typeof body?.onboardingCompleted === "boolean"
        ? body.onboardingCompleted
        : current.onboardingCompleted,
    locationEnabled:
      typeof body?.locationEnabled === "boolean"
        ? body.locationEnabled
        : current.locationEnabled,
    updatedAt: now,
    syncRevision: (current.syncRevision || 0) + 1,
    schemaVersion: SCHEMA_VERSION,
    deletedAt: null,
  };
  await collection.updateOne(
    { userId },
    { $set: next, $setOnInsert: { userId, createdAt: now } },
    { upsert: true },
  );
  return { userId, createdAt: current.createdAt, ...next, updatedAt: now.toISOString() };
}

export async function migrateLocalData(userId: string, body: any) {
  const results = {
    wallet: { imported: 0, skipped: 0, errors: [] as string[] },
    paymentJourney: { imported: 0, skipped: 0, errors: [] as string[] },
    plans: { imported: 0, skipped: 0, errors: [] as string[] },
    preferences: { imported: 0, skipped: 0, errors: [] as string[] },
  };
  try {
    if (Array.isArray(body?.wallet?.cards) || Array.isArray(body?.wallet?.cardSlugs)) {
      const wallet = await replaceCloudWallet(userId, {
        cardSlugs: body.wallet.cardSlugs || body.wallet.cards.map((card: any) => card.cardId),
      }, "local_migration");
      results.wallet.imported = wallet.cardSlugs.length;
    }
  } catch (error: any) {
    results.wallet.errors.push(error.message || "wallet migration failed");
  }
  for (const entry of Array.isArray(body?.paymentJourney) ? body.paymentJourney : []) {
    try {
      await createPaymentJourney(userId, { ...entry, clientIdempotencyKey: entry.id || entry.paymentId });
      results.paymentJourney.imported += 1;
    } catch (error: any) {
      results.paymentJourney.skipped += 1;
      results.paymentJourney.errors.push(error.message || "payment migration failed");
    }
  }
  for (const plan of Array.isArray(body?.plans) ? body.plans : []) {
    try {
      const created = await createCloudPlan(userId, plan);
      for (const item of plan.items || []) await addCloudPlanItem(userId, created.planId, item);
      results.plans.imported += 1;
    } catch (error: any) {
      results.plans.skipped += 1;
      results.plans.errors.push(error.message || "plan migration failed");
    }
  }
  if (body?.preferences || body?.favorites) {
    try {
      await updatePreferences(userId, {
        ...body.preferences,
        favoriteMerchants: body.favorites || body.preferences?.favoriteMerchants,
      });
      results.preferences.imported = 1;
    } catch (error: any) {
      results.preferences.errors.push(error.message || "preferences migration failed");
    }
  }
  return { migrationId: `mig_${crypto.randomUUID()}`, results, completedAt: new Date().toISOString() };
}

export async function ensureUserDataIndexes() {
  const [wallets, journey, plans, prefs] = await Promise.all([
    getUserWalletsCollection(),
    getPaymentJourneyCollection(),
    getUserShoppingPlansCollection(),
    getUserPreferencesCollection(),
  ]);
  await Promise.all([
    wallets.createIndex({ userId: 1 }, { unique: true }),
    journey.createIndex({ userId: 1, paymentId: 1 }, { unique: true }),
    journey.createIndex({ userId: 1, clientIdempotencyKey: 1 }, { sparse: true }),
    journey.createIndex({ userId: 1, completedAt: -1 }),
    plans.createIndex({ userId: 1, planId: 1 }, { unique: true }),
    plans.createIndex({ userId: 1, updatedAt: -1 }),
    prefs.createIndex({ userId: 1 }, { unique: true }),
  ]);
}

function publicWallet(wallet: UserWallet) {
  return {
    cardSlugs: wallet.cardSlugs,
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
    schemaVersion: wallet.schemaVersion,
    syncRevision: wallet.syncRevision,
  };
}

function publicPaymentJourney(record: PaymentJourneyRecord) {
  return {
    paymentId: record.paymentId,
    decisionId: record.decisionId || null,
    merchant: record.merchant,
    amount: record.amount,
    currency: record.currency,
    recommendedCard: record.recommendedCard || null,
    selectedCard: record.selectedCard || null,
    estimatedValue: record.estimatedValue ?? null,
    confidence: record.confidence ?? null,
    notes: record.notes || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() || null,
    schemaVersion: record.schemaVersion,
    syncRevision: record.syncRevision,
  };
}

function publicPlan(plan: UserShoppingPlanRecord) {
  return {
    planId: plan.planId,
    title: plan.title,
    notes: plan.notes || undefined,
    status: plan.status,
    currency: plan.currency,
    items: plan.items,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    schemaVersion: plan.schemaVersion,
    syncRevision: plan.syncRevision,
  };
}

function publicPreferences(prefs: UserPreferencesRecord) {
  return {
    favoriteMerchants: prefs.favoriteMerchants,
    theme: prefs.theme || "system",
    defaultCurrency: prefs.defaultCurrency,
    onboardingCompleted: prefs.onboardingCompleted,
    locationEnabled: Boolean(prefs.locationEnabled),
    createdAt: prefs.createdAt.toISOString(),
    updatedAt: prefs.updatedAt.toISOString(),
    schemaVersion: prefs.schemaVersion,
    syncRevision: prefs.syncRevision,
  };
}

function publicFavorite(input: any) {
  return {
    name: cleanString(input?.name, 160),
    category: cleanString(input?.category, 120) || undefined,
    domain: cleanString(input?.domain, 120) || undefined,
    merchantId: cleanString(input?.merchantId, 120) || undefined,
  };
}

async function validateCardSlugs(cardSlugs: string[]) {
  const normalized = cardSlugs.map(normalizeCardSlug).filter(Boolean);
  if (normalized.length !== cardSlugs.filter(Boolean).length || new Set(normalized).size !== normalized.length) {
    throw validation("Wallet contains duplicate or malformed cards.");
  }
  const cards = await getCardsCollection();
  const found = await cards.find({ slug: { $in: normalized } }, { projection: { _id: 0, slug: 1 } }).toArray();
  const valid = new Set(found.map((card: any) => String(card.slug)));
  const unknown = normalized.filter((slug) => !valid.has(slug));
  if (unknown.length) throw validation("Wallet contains unsupported cards.");
  return normalized;
}

function normalizeCardSlug(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/_/g, "-");
}

function validation(message: string) {
  return new AuthError(400, "VALIDATION_ERROR", message);
}

function cleanString(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeNotes(value: unknown) {
  const text = cleanString(value, 500);
  return text || null;
}

function parseDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sumKnownRewards(items: Array<{ decision: { estimatedValue: number | null } }>) {
  let total = 0;
  let any = false;
  for (const item of items) {
    if (typeof item.decision.estimatedValue === "number") {
      total += item.decision.estimatedValue;
      any = true;
    }
  }
  return any ? Number(total.toFixed(2)) : null;
}
