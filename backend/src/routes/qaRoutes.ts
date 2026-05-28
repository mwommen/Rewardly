// backend/src/routes/qaRoutes.ts
import { Router } from "express";
import { getCardsCollection, getLinkedAccountsCollection } from "../db";
import { findMerchantBenefits } from "../services/benefitsQaService";
import { inferMerchantForHost } from "../utils/merchant";
import { validateBenefitsQuality } from "../validateBenefitsQuality";
import { buildBenefitsAudit } from "../benefitsAudit";

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

/**
 * GET /api/qa/summary
 * Query: userId=...
 * Returns a compact readiness summary for MVP runtime QA.
 */
router.get("/qa/summary", async (req, res) => {
  try {
    const userId = String(req.query.userId || "devUser").trim() || "devUser";

    const cardsCol = await getCardsCollection();
    const linkedCol = await getLinkedAccountsCollection();

    const [cards, linkedDocs] = await Promise.all([
      cardsCol.find({}).toArray(),
      linkedCol.find({ userId }).toArray(),
    ]);

    const validationFailures = validateBenefitsQuality(cards as any[]);
    const audit = buildBenefitsAudit(cards as any[]);

    const linkedAccounts = linkedDocs.flatMap((doc: any) => doc?.accounts || []);
    const linkedCreditAccounts = linkedAccounts.filter((account: any) => {
      const type = String(account?.type || "").toLowerCase();
      const subtype = String(account?.subtype || "").toLowerCase();
      return type.includes("credit") || subtype.includes("credit");
    });
    const mappedLinkedCards = Array.from(
      new Set(
        linkedCreditAccounts
          .map((account: any) => String(account?.mappedCardSlug || "").trim())
          .filter(Boolean)
      )
    );
    const unresolvedLinkedCards = linkedCreditAccounts.filter((account: any) => {
      const slug = String(account?.mappedCardSlug || "").trim();
      return !slug || slug === "unknown" || slug === "generic-credit";
    });

    return res.json({
      userId,
      cards: {
        total: cards.length,
        validationFailureCount: validationFailures.length,
        cardsWithIssues: audit.cardIssues.length,
        suspiciousBenefitCount: audit.suspiciousBenefits.length,
      },
      linkedAccounts: {
        totalDocs: linkedDocs.length,
        totalAccounts: linkedAccounts.length,
        creditAccounts: linkedCreditAccounts.length,
        mappedCards: mappedLinkedCards.length,
        unresolvedMappings: unresolvedLinkedCards.length,
      },
      samples: {
        validationFailures: validationFailures.slice(0, 10),
        suspiciousBenefits: audit.suspiciousBenefits.slice(0, 10).map((item) => ({
          example: item.example,
          suspicionScore: item.suspicionScore,
          reasons: item.reasons,
          issuers: item.issuers,
        })),
        cardIssues: audit.cardIssues.slice(0, 10),
      },
      status:
        validationFailures.length === 0 && unresolvedLinkedCards.length === 0
          ? "ready_for_runtime_qa"
          : "needs_attention",
    });
  } catch (e: any) {
    console.error("[qa/summary] error:", e);
    return res.status(500).json({ error: e?.message || "qa_summary_error" });
  }
});

export default router;
