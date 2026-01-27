// backend/src/routes/qaRoutes.ts
import { Router } from "express";
import { findMerchantBenefits } from "../services/benefitsQaService";
import { inferMerchantForHost } from "../utils/merchant";

const router = Router();

/**
 * GET /api/qa/benefits
 * Query: merchant=... or host=...
 * Returns cards with active merchant credits that match.
 */
router.get("/qa/benefits", async (req, res) => {
  try {
    const merchantRaw = String(req.query.merchant || "").trim();
    const hostRaw = String(req.query.host || "").trim();
    const merchant = merchantRaw || (hostRaw ? inferMerchantForHost(hostRaw).name : "");
    if (!merchant) return res.status(400).json({ error: "merchant or host required" });

    const matches = await findMerchantBenefits(merchant);
    return res.json({
      merchant,
      count: matches.length,
      matches,
    });
  } catch (e: any) {
    console.error("[qa/benefits] error:", e);
    return res.status(500).json({ error: e?.message || "qa_benefits_error" });
  }
});

export default router;
