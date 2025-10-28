// backend/src/routes/scrapeRoutes.ts
import { Router } from "express";
import { runScrapers, scrapeCardUrl } from "../scrapers/scrapeCard";
import { getCardsCollection } from "../db";
import type { UpdateFilter, Collection } from "mongodb";

const router = Router();

// Shape of what we store in Mongo for a card
type StoredCard = {
  slug: string;
  name?: string;
  issuer?: string | null;
  annualFee?: number | null;
  rewardsByCategory?: Record<string, number>;
  perks?: string[];
  signupOffer?: string | null;
  sourceUrl?: string;
  confidence?: number;
  lastScraped?: string;
};

/**
 * POST /api/scrape
 * Body: { issuers?: string[] }
 * Runs the registered Playwright adapters (e.g., amex/chase/citi/discover) and upserts results.
 * Returns a summary per issuer.
 */
router.post("/", async (req, res) => {
  try {
    const issuers: string[] | undefined = Array.isArray(req.body?.issuers)
      ? req.body.issuers.map((s: any) => String(s).toLowerCase())
      : undefined;

    const results = await runScrapers(issuers);
    return res.json({ ok: true, results });
  } catch (e: any) {
    console.error("[scrapeRoutes] bulk run error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
});

/**
 * POST /api/scrape/cards/scrape
 * Body: { url: string, slug: string }
 * Scrapes a single card URL (manual), merges safely, returns the stored doc.
 */
router.post("/cards/scrape", async (req, res) => {
  try {
    const { url, slug } = (req.body || {}) as { url?: string; slug?: string };
    if (!url || !slug) return res.status(400).json({ error: "Missing url or slug" });

    const resultRaw = await scrapeCardUrl(url, slug);
    if (!resultRaw) return res.status(502).json({ ok: false, error: "Scrape failed" });

    // Narrow result to our partial StoredCard shape
    const result: Partial<StoredCard> & { slug: string } = {
      slug,
      name: resultRaw.name,
      issuer: resultRaw.issuer ?? null,
      annualFee: typeof resultRaw.annualFee === "number" ? resultRaw.annualFee : null,
      rewardsByCategory: resultRaw.rewardsByCategory || {},
      perks: resultRaw.perks || [],
      signupOffer: resultRaw.signupOffer ?? null,
      sourceUrl: resultRaw.sourceUrl || url,
      confidence: typeof (resultRaw as any).confidence === "number" ? (resultRaw as any).confidence : 0,
      lastScraped: resultRaw.lastScraped || new Date().toISOString(),
    };

    // properly type the collection to avoid $set errors
    const colAny = await getCardsCollection();
    const col = colAny as unknown as Collection<StoredCard>;

    const existing = await col.findOne({ slug });

    // ✅ Type-safe merged object
    const merged: StoredCard = {
      ...(existing || {}),
      ...(result || {}),

      // keep best non-empty reward map
      rewardsByCategory:
        result.rewardsByCategory && Object.keys(result.rewardsByCategory).length
          ? result.rewardsByCategory
          : existing?.rewardsByCategory || {},

      // keep non-empty perks
      perks: result.perks && result.perks.length ? result.perks : existing?.perks || [],

      // prefer newest non-null fields
      signupOffer: result.signupOffer ?? existing?.signupOffer ?? null,
      issuer: result.issuer ?? existing?.issuer ?? null,
      lastScraped: result.lastScraped ?? existing?.lastScraped ?? new Date().toISOString(),
      confidence:
        typeof result.confidence === "number"
          ? result.confidence
          : typeof existing?.confidence === "number"
          ? existing.confidence
          : 0,
      sourceUrl: result.sourceUrl ?? existing?.sourceUrl ?? url,

      // ensure slug is set
      slug,
    };

    // 👇 fixed: cast to UpdateFilter<StoredCard> so $set is valid
    await col.updateOne(
      { slug },
      { $set: merged } as UpdateFilter<StoredCard>,
      { upsert: true }
    );

    const stored = await col.findOne({ slug });
    return res.json({ ok: true, stored });
  } catch (e: any) {
    console.error("[scrapeRoutes] single-card error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /api/scrape/cards/:slug
 * Fetch a single card doc (handy for admin/QA)
 */
router.get("/cards/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const colAny = await getCardsCollection();
    const col = colAny as unknown as Collection<StoredCard>;

    const doc = await col.findOne({ slug });
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  } catch (e) {
    console.error("[scrapeRoutes] fetch card error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
