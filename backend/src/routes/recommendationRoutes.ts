// backend/src/routes/recommendationRoutes.ts
import { Router } from "express";
import { recommendAllBenefits, recommendBestCards } from "../services/recommendationService";

const router = Router();

/** Parse comma-separated fields=... and whitelist allowed props */
const ALLOWED_FIELDS = new Set([
  "slug",
  "name",
  "issuer",
  "effectiveRate",
  "estValueUSD",
  "confidence",
  "reason",
  "why",
  "matchTier",
  "confidenceLabel",
  "matchedBenefit",
  "lastVerified",
  "matchingCategories",
  "annualFee",
  "perks",
  "signupOffer",
  "sourceUrl",
]);

function parseFieldsParam(q: any): string[] | undefined {
  const raw = typeof q.fields === "string" ? q.fields.trim() : "";
  if (!raw) return undefined;

  const fields = raw
    .split(",")
    .map((part: string) => part.trim())
    .filter((f: string) => f.length > 0 && ALLOWED_FIELDS.has(f));

  return fields.length ? fields : undefined;
}


/** Apply a field projection at the edge without mutating service output */
function project<T extends Record<string, any>>(items: T[], fields?: string[]): Partial<T>[] {
  if (!fields) return items;
  return items.map((it) => {
    const out: Record<string, any> = {};
    for (const f of fields) out[f] = it[f];
    return out as Partial<T>;
  });
}

/** Group offers by their main “reason” (Dining, Rotating, Base/Other) */
function groupByReason(
  offers: any[]
): Record<"Dining" | "Rotating" | "Base/Other", any[]> {
  const groups: Record<"Dining" | "Rotating" | "Base/Other", any[]> = {
    Dining: [],
    Rotating: [],
    "Base/Other": [],
  };

  for (const o of offers) {
    const reason = String(o.reason || "").toLowerCase();

    if (reason.startsWith("category:dining")) {
      groups.Dining.push(o);
    } else if (reason.startsWith("rotating:")) {
      groups.Rotating.push(o);
    } else {
      groups["Base/Other"].push(o);
    }
  }
  return groups;
}

/**
 * GET /api/recommendations/best
 * Example: /api/recommendations/best?merchant=Starbucks&amount=12.50&mcc=5814&fields=name,effectiveRate,estValueUSD,reason
 */
router.get("/best", async (req, res) => {
  const merchant = String(req.query.merchant || "").trim();
  if (!merchant) return res.status(400).json({ error: "merchant is required" });

  const amount = req.query.amount ? Number(req.query.amount) : undefined;
  const mcc = req.query.mcc ? String(req.query.mcc) : undefined;
  const includeRotating = req.query.includeRotating !== "false";
  const limit = typeof req.query.limit !== "undefined" ? Math.max(1, Number(req.query.limit)) : undefined;
  const fields = parseFieldsParam(req.query);

  try {
    const result = await recommendBestCards({
      merchant,
      amount,
      mcc,
      includeRotating,
      scoringMode: "strict_production",
    });

    // Apply limit + fields at the edge
    let recs = result.recommendations || [];
    if (limit) recs = recs.slice(0, limit);
    const projected = project(recs as any[], fields);

    res.json({
      merchant: result.merchant,
      amount: result.amount,
      categoriesUsed: result.categoriesUsed,
      recommendations: projected,
    });
  } catch (err) {
    console.error("[recommendationRoutes/best] Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /api/recommendations/offers
 * Example:
 *   /api/recommendations/offers?merchant=Starbucks&amount=12.50&mcc=5814&limit=10
 *   /api/recommendations/offers?merchant=Starbucks&fields=name,effectiveRate,perks,signupOffer
 *   /api/recommendations/offers?merchant=Starbucks&group=true
 */
router.get("/offers", async (req, res) => {
  const merchant = String(req.query.merchant || "").trim();
  if (!merchant) return res.status(400).json({ error: "merchant is required" });

  const amount = req.query.amount ? Number(req.query.amount) : undefined;
  const mcc = req.query.mcc ? String(req.query.mcc) : undefined;
  const includeRotating = req.query.includeRotating !== "false";
  const minRate = typeof req.query.minRate !== "undefined" ? Number(req.query.minRate) : 0;
  const limit = typeof req.query.limit !== "undefined" ? Math.max(1, Number(req.query.limit)) : undefined;
  const fields = parseFieldsParam(req.query);
  const group = String(req.query.group || "").toLowerCase() === "true";

  try {
    const result = await recommendAllBenefits({
      merchant,
      amount,
      mcc,
      includeRotating,
      minRate,
      scoringMode: "strict_production",
    });

    let offers = (result.offers || []).filter((o: any) => Array.isArray(o?.perks) && o.perks.length);
    if (limit) offers = offers.slice(0, limit);
    const projected = project(offers as any[], fields);

    if (group) {
      const grouped = groupByReason(projected as any[]);
      return res.json({
        merchant: result.merchant,
        amount: result.amount,
        categoriesUsed: result.categoriesUsed,
        groupedOffers: grouped,
      });
    }

    res.json({
      merchant: result.merchant,
      amount: result.amount,
      categoriesUsed: result.categoriesUsed,
      offers: projected,
    });
  } catch (err) {
    console.error("[recommendationRoutes/offers] Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
