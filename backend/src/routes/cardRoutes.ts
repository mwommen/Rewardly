// backend/src/routes/cardRoutes.ts
import express, { Request, Response } from "express";
import { getCardsCollection, getLinkedAccountsCollection } from "../db";
import { CARD_OVERRIDES } from "../scrapers/overrides/cards";
import { collectCreditMatches } from "../utils/merchantMatching";

const router = express.Router();

/**
 * GET /api/cards
 * Returns all cards in the catalog.
 */
router.get("/", async (_req, res) => {
  try {
    const col = await getCardsCollection();
    const cards = await col.find({}).toArray();
    const merged = cards.map(applyCardOverride);
    res.json({ cards: dedupeCards(merged) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to fetch cards" });
  }
});

// GET /api/cards/slugs -> [{ slug, name }]
router.get("/slugs", async (_req, res) => {
  try {
    const col = await getCardsCollection();
    const cards = await col.find(
      { slug: { $exists: true } },
      { projection: { _id: 0, slug: 1, name: 1 } }
    ).toArray();
    const seen = new Set<string>();
    const slugs = cards.filter((c) => {
      const key = String(c.slug || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json({ slugs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to fetch slugs" });
  }
});

/**
 * POST /api/cards
 * Upsert a card by slug.
 * Body example:
 * {
 *   "slug":"amex-gold",
 *   "name":"American Express® Gold",
 *   "rewardsByCategory":{"default":1,"groceries":4,"apparel":3,"online_shopping":2},
 *   "perks":["$10 dining credit (select partners)"]
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const card = req.body || {};
    if (!card.slug || !card.name) {
      return res.status(400).json({ error: "slug and name are required" });
    }
    const col = await getCardsCollection();
    await col.updateOne({ slug: card.slug }, { $set: card as any }, { upsert: true });
    const saved = await col.findOne({ slug: card.slug });
    res.json({ ok: true, card: saved });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to upsert card" });
  }
});

/**
 * GET /api/cards/:slug/history
 * Returns benefit history snapshots for a card.
 * Query params: limit (default 10, max 100)
 */
router.get("/:slug/history", async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const limitRaw = Number(req.query.limit || 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 10;

    const db = await (await import("../db")).getDb();
    const historyCol = db.collection("benefits_history");
    const snapshots = await historyCol
      .find({ slug })
      .sort({ scrapedAt: -1 })
      .limit(limit)
      .toArray();

    res.json({ slug, count: snapshots.length, snapshots });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load history" });
  }
});

/**
 * POST /api/cards/best-card-for-merchant
 * Determines the best card among the user's Plaid-linked accounts.
 * Body: { merchant: string, userId?: string, restrictToLinked?: boolean, manualCardSlugs?: string[] }
 */
router.post("/best-card-for-merchant", async (req: Request, res: Response) => {
  try {
    const { merchant, userId = "devUser", restrictToLinked = false, manualCardSlugs = [] } = req.body || {};
    if (!merchant || typeof merchant !== "string") {
      return res.status(400).json({ error: "merchant required" });
    }

    // 1) Fetch catalog
    const cardsCol = await getCardsCollection();
    const allCards = (await cardsCol.find({}).toArray()).map(applyCardOverride);

    // 2) Fetch user's linked accounts (from Plaid exchange)
    const linkedCol = await getLinkedAccountsCollection();
    const linkedDocs = await linkedCol.find({ userId }).toArray();

    // 3) Build allowed slugs from mapped accounts
    const allowed = new Set<string>();
    for (const doc of linkedDocs) {
      for (const a of doc.accounts || []) {
        if (a?.mappedCardSlug) allowed.add(a.mappedCardSlug);
      }
    }
    if (Array.isArray(manualCardSlugs)) {
      for (const slug of manualCardSlugs) {
        const normalized = String(slug || "").trim();
        if (normalized) allowed.add(normalized);
      }
    }
    const hasLinkedCards = allowed.size > 0;
    // Allow generic fallback only when not restricting to linked cards
    if (!restrictToLinked) {
      allowed.add("generic-credit");
    }

    // 4) Merchant -> category mapping
    const category = toCategory(merchant);
    const isCategoryQuery = isCategorySearch(merchant);

    // 5) Score cards; use linked cards only when explicitly requested
    const allowedCards = allCards.filter((c: any) => c.slug && allowed.has(c.slug));
    const scopedCards = restrictToLinked ? allowedCards : allCards;

    if (!scopedCards.length) {
      return res.json({
        merchant,
        category,
        bestCard: null,
        reason: null,
        candidates: [],
        benefitMatches: [],
        linkedAccountSlugs: Array.from(allowed),
        note: "No linked cards found for this user.",
      });
    }

    const scored = scopedCards
      .map((c: any) => {
        const rewardsByCategory = getRewardsByCategory(c);
        const rate = getCategoryRate(rewardsByCategory, category);
        const creditMatches = isCategoryQuery ? [] : collectCreditMatches(c, merchant);
        const score = rate + (creditMatches.length ? 100 : 0);
        return { card: c, score, creditMatches };
      })
      .sort((a, b) => b.score - a.score);

    const filteredScored = isCategoryQuery ? scored : scored.filter((entry) => entry.creditMatches.length);

    if (!filteredScored.length) {
      return res.json({
        merchant,
        category,
        bestCard: null,
        reason: null,
        candidates: [],
        benefitMatches: [],
        linkedAccountSlugs: Array.from(allowed),
        note: "No merchant-specific benefits found for this merchant.",
      });
    }

    const best = filteredScored[0]?.card || null;
    const reason = best ? buildReason(best, merchant, category, isCategoryQuery) : null;
    const candidatesWithReason = filteredScored.slice(0, 5).map((entry) => ({
      ...entry,
      reason: buildReason(entry.card, merchant, category, isCategoryQuery),
    }));
    const benefitMatches = filteredScored
      .filter((entry) => entry.creditMatches && entry.creditMatches.length)
      .filter((entry) => entry.card && entry.card._id !== best?._id)
      .reduce<{ card: any; reason: ReturnType<typeof buildReason> }[]>((acc, entry) => {
        const slug = entry.card?.slug || entry.card?._id || entry.card?.name;
        if (!slug) return acc;
        if (acc.some((x) => (x.card?.slug || x.card?._id || x.card?.name) === slug)) return acc;
        acc.push({ card: entry.card, reason: buildReason(entry.card, merchant, category, isCategoryQuery) });
        return acc;
      }, [])
      .slice(0, 5);

    return res.json({
      merchant,
      category,
      bestCard: best,
      reason,
      candidates: candidatesWithReason,
      benefitMatches,
      linkedAccountSlugs: Array.from(allowed),
      note: !hasLinkedCards && !restrictToLinked
        ? "No linked accounts yet. Showing best match from full catalog."
        : undefined,
    });
  } catch (e: any) {
    console.error("best-card error:", e);
    res.status(500).json({ error: e?.message || "best-card error" });
  }
});

/**
 * GET /api/cards/best-card/:category
 * Lightweight endpoint for category-based highlighting.
 */
router.get("/best-card/:category", async (req: Request, res: Response) => {
  try {
    const category = (req.params.category || "").toLowerCase();
    if (!category) return res.status(400).json({ error: "category required" });

    const cardsCol = await getCardsCollection();
    const allCards = await cardsCol.find({}).toArray();
    if (!allCards.length) return res.json({ category, bestCard: null, candidates: [] });

    const scored = allCards
      .map((c: any) => {
        const rate =
          (c.rewardsByCategory && (c.rewardsByCategory[category] ?? c.rewardsByCategory.default)) ||
          0;
        return { card: c, score: Number(rate) || 0 };
      })
      .sort((a, b) => b.score - a.score);

    return res.json({
      category,
      bestCard: scored[0]?.card || null,
      candidates: scored.slice(0, 5),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "best-card error" });
  }
});

// ------- helpers -------

function toCategory(merchant: string): string {
  const m = merchant.toLowerCase();
  if (m.includes("amazon")) return "online_shopping";
  if (m.includes("walmart") || m.includes("target") || m.includes("costco")) return "groceries";
  if (m.includes("lululemon") || m.includes("nike") || m.includes("adidas")) return "apparel";
  if (m.includes("uber") || m.includes("lyft")) return "rideshare";
  if (m.includes("saks")) return "departmentstores";
  return "default";
}

function isCategorySearch(merchant: string): boolean {
  const m = merchant.toLowerCase().trim();
  return [
    "travel",
    "dining",
    "groceries",
    "gas",
    "drugstore",
    "streaming",
    "entertainment",
    "apparel",
    "rideshare",
    "departmentstores",
    "online_shopping",
  ].includes(m);
}

function buildReason(
  card: any,
  merchant: string,
  category: string,
  isCategoryQuery = false
): {
  text: string;
  matches: string[];
  credits: Array<{
    label: string;
    requiresEnrollment?: boolean;
    sourceUrl?: string;
    enrollmentUrl?: string;
    partner?: string;
    benefitKey?: string;
  }>;
} {
  const reasons: string[] = [];
  const matches: string[] = [];
  const credits: Array<{
    label: string;
    requiresEnrollment?: boolean;
    sourceUrl?: string;
    enrollmentUrl?: string;
    partner?: string;
    benefitKey?: string;
  }> = [];
  const rate = getCategoryRate(getRewardsByCategory(card), category);
  if (rate > 0) {
    reasons.push(`${formatWalletRate(rate)} on ${category}`);
  }

  const matchedCredits = isCategoryQuery ? [] : collectCreditMatches(card, merchant);
  if (matchedCredits.length) {
    const labels = matchedCredits
      .slice(0, 2)
      .map((c: any) => sanitizeLabel(c.label || "credit"));
    matches.push(...labels);
    credits.push(
      ...matchedCredits.map((c: any) => ({
        label: sanitizeLabel(c.label || "credit"),
        requiresEnrollment: !!c.requiresEnrollment,
        sourceUrl: c.sourceUrl,
        enrollmentUrl: c.enrollmentUrl || getEnrollmentUrl(card, c),
        partner: c.partner,
        benefitKey: createBenefitKey(card, sanitizeLabel(c.label || "credit")),
      }))
    );
    reasons.push(`credit match: ${labels.join(", ")}`);
  }

  const text = reasons.length ? reasons.join(" • ") : "best available rate in your catalog";
  return { text, matches, credits };
}

function sanitizeLabel(label: string): string {
  return (label || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createBenefitKey(card: any, label: string): string {
  const slug = String(card?.slug || card?.name || "").trim().toLowerCase().replace(/\s+/g, "-");
  const normalizedLabel = String(label || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${slug}::${normalizedLabel}`;
}

function getEnrollmentUrl(card: any, credit: any): string | undefined {
  const slug = String(card?.slug || "").toLowerCase();
  const label = String(credit?.label || credit?.name || credit?.partner || "").toLowerCase();
  if (slug === "amex-platinum") {
    if (label.includes("lululemon")) {
      return "https://global.americanexpress.com/card-benefits/detail/lululemon/platinum";
    }
    if (label.includes("saks")) {
      return "https://global.americanexpress.com/card-benefits/detail/shopsakswithplatinum/platinum";
    }
    if (label.includes("uber")) {
      return "https://global.americanexpress.com/card-benefits/detail/uber-cash/platinum";
    }
    if (label.includes("digital entertainment")) {
      return "https://global.americanexpress.com/card-benefits/detail/digital-entertainment/platinum";
    }
    if (label.includes("clear")) {
      return "https://global.americanexpress.com/card-benefits/detail/clear/platinum";
    }
    if (label.includes("walmart")) {
      return "https://global.americanexpress.com/card-benefits/detail/walmart-plus/platinum";
    }
  }
  return undefined;
}

function formatWalletRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  if (rate < 1) {
    const percent = rate * 100;
    return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
  }
  return `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(2)}x`;
}

function getBenefits(card: any) {
  return card?.benefitsDetail || card || {};
}

function getRewardsByCategory(card: any) {
  return getBenefits(card)?.rewardsByCategory || card?.rewardsByCategory || null;
}

function getCardCredits(card: any) {
  const benefits = getBenefits(card);
  return {
    merchantCredits: benefits.merchantCredits || card?.merchantCredits || [],
    recurringCredits: benefits.recurringCredits || card?.recurringCredits || [],
  };
}

function applyCardOverride(card: any) {
  const override = card?.slug ? CARD_OVERRIDES[card.slug] : undefined;
  if (!override) return card;
  return {
    ...card,
    name: override.name ?? card.name,
    issuer: override.issuer ?? card.issuer,
    annualFee: override.annualFee ?? card.annualFee,
    apr: override.apr ?? card.apr,
    sourceUrl: override.sourceUrl ?? card.sourceUrl,
    rewardsByCategory: override.rewardsByCategory ?? card.rewardsByCategory,
    perks: override.perks ?? card.perks,
    signupOffer: override.signupOffer ?? card.signupOffer,
    merchantCredits: override.merchantCredits ?? card.merchantCredits,
    recurringCredits: override.recurringCredits ?? card.recurringCredits,
    benefitsDetail: override.benefitsDetail ?? card.benefitsDetail,
  };
}

function parseRateValue(rate: unknown): number {
  if (typeof rate === "number" && Number.isFinite(rate)) return rate;
  if (typeof rate === "string") {
    const n = parseFloat(rate);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getCategoryRate(rewardsByCategory: any, category: string): number {
  if (!rewardsByCategory) return 0;
  if (Array.isArray(rewardsByCategory)) {
    let best = 0;
    for (const entry of rewardsByCategory) {
      const keys = Array.isArray(entry?.keys) ? entry.keys.map((k: any) => String(k).toLowerCase()) : [];
      if (!keys.length) continue;
      if (!keys.includes(category) && !keys.includes("default") && !keys.includes("other")) continue;
      const rate = parseRateValue(entry?.rate);
      if (rate > best) best = rate;
    }
    return best;
  }
  const direct = parseRateValue(rewardsByCategory[category]);
  if (direct) return direct;
  return parseRateValue(rewardsByCategory.default ?? rewardsByCategory.other);
}

function dedupeCards(cards: any[]) {
  const byKey = new Map<string, any>();
  for (const card of cards) {
    const key = cardKey(card);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, card);
      continue;
    }
    if (cardQualityScore(card) > cardQualityScore(existing)) {
      byKey.set(key, card);
    }
  }
  return Array.from(byKey.values());
}

function cardKey(card: any): string | null {
  const slug = String(card?.slug || "").trim().toLowerCase();
  if (slug) return `slug:${slug}`;
  const name = String(card?.name || "").trim().toLowerCase();
  const issuer = String(card?.issuer || "").trim().toLowerCase();
  if (name) return `name:${name}|issuer:${issuer}`;
  return null;
}

function cardQualityScore(card: any): number {
  let score = 0;
  if (card?.benefitsDetail) score += 6;
  const rewards = card?.rewardsByCategory;
  if (Array.isArray(rewards)) score += Math.min(rewards.length, 6);
  if (rewards && typeof rewards === "object" && !Array.isArray(rewards)) {
    score += Math.min(Object.keys(rewards).length, 6);
  }
  score += Math.min((card?.merchantCredits || []).length, 4);
  score += Math.min((card?.recurringCredits || []).length, 4);
  score += Math.min((card?.perks || []).length, 4);
  if (Number.isFinite(card?.annualFee)) score += 2;
  if (card?.sourceUrl) score += 1;
  if (card?.lastScraped || card?.lastUpdated) score += 1;
  return score;
}

export default router;
