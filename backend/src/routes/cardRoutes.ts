// backend/src/routes/cardRoutes.ts
import express, { Request, Response } from "express";
import { getCardsCollection, getLinkedAccountsCollection } from "../db";

const router = express.Router();

/**
 * GET /api/cards
 * Returns all cards in the catalog.
 */
router.get("/", async (_req, res) => {
  try {
    const col = await getCardsCollection();
    const cards = await col.find({}).toArray();
    res.json({ cards });
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
    res.json({ slugs: cards });
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
 * Body: { merchant: string, userId?: string }
 */
router.post("/best-card-for-merchant", async (req: Request, res: Response) => {
  try {
    const { merchant, userId = "devUser" } = req.body || {};
    if (!merchant || typeof merchant !== "string") {
      return res.status(400).json({ error: "merchant required" });
    }

    // 1) Fetch catalog
    const cardsCol = await getCardsCollection();
    const allCards = await cardsCol.find({}).toArray();

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
    // Always allow generic fallback if present
    allowed.add("generic-credit");

    // 4) Merchant -> category mapping
    const category = toCategory(merchant);

    // 5) Score cards; use linked cards if available, otherwise fallback to all cards
    const scopedCards =
      allowed.size > 0
        ? allCards.filter((c: any) => c.slug && allowed.has(c.slug))
        : allCards;

    const scored = scopedCards
      .map((c: any) => {
        const rate =
          (c.rewardsByCategory && (c.rewardsByCategory[category] ?? c.rewardsByCategory.default)) ||
          0;
        return { card: c, score: Number(rate) || 0 };
      })
      .sort((a, b) => b.score - a.score);

    return res.json({
      merchant,
      category,
      bestCard: scored[0]?.card || null,
      candidates: scored.slice(0, 5),
      linkedAccountSlugs: Array.from(allowed),
      note: allowed.size === 0 ? "No linked accounts yet. Showing best match from full catalog." : undefined,
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
  return "default";
}

export default router;
