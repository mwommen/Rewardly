// backend/src/routes/cardRoutes.ts
import express, { Request, Response } from "express";
import { getCardsCollection, getLinkedAccountsCollection } from "../db";

const router = express.Router();

/**
 * GET /api/cards
 * Returns all cards in the catalog.
 */
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

    // If nothing linked, return a helpful note
    if (allowed.size === 0) {
      return res.json({
        merchant,
        category: "default",
        bestCard: null,
        candidates: [],
        note: "No linked accounts found for this user. Link via Plaid first.",
      });
    }

    // 4) Merchant -> category mapping
    const category = toCategory(merchant);

    // 5) Score only allowed cards
    const scored = allCards
      .filter((c: any) => c.slug && allowed.has(c.slug))
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
    });
  } catch (e: any) {
    console.error("best-card error:", e);
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
