import express from "express";
import { getCardsCollection, getLinkedAccountsCollection, getUserBenefitStatesCollection } from "../db";

const router = express.Router();

router.get("/user-benefits", async (req, res) => {
  try {
    const userId = String(req.query.userId || "devUser").trim() || "devUser";
    const col = await getUserBenefitStatesCollection();
    const docs = await col.find({ userId }).toArray();
    res.json({
      userId,
      states: docs.map((doc: any) => ({
        benefitKey: doc.benefitKey,
        cardSlug: doc.cardSlug || null,
        cardName: doc.cardName || null,
        label: doc.label || null,
        period: doc.period || null,
        amountUSD: Number.isFinite(doc.amountUSD) ? doc.amountUSD : null,
        requiresEnrollment: !!doc.requiresEnrollment,
        enrolled: !!doc.enrolled,
        enrolledAt: doc.enrolledAt ? new Date(doc.enrolledAt).toISOString() : null,
        usedAt: doc.usedAt ? new Date(doc.usedAt).toISOString() : null,
        remindEnabled: !!doc.remindEnabled,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load user benefit states" });
  }
});

router.post("/user-benefits/state", async (req, res) => {
  try {
    const {
      userId = "devUser",
      benefitKey,
      cardSlug = null,
      cardName = null,
      label = null,
      period = null,
      amountUSD = null,
      requiresEnrollment = false,
      enrolled,
      usedAt,
      remindEnabled,
    } = req.body || {};

    if (!benefitKey || typeof benefitKey !== "string") {
      return res.status(400).json({ error: "benefitKey required" });
    }

    const next: Record<string, unknown> = {
      userId,
      benefitKey,
      cardSlug,
      cardName,
      label,
      period,
      amountUSD: Number.isFinite(amountUSD) ? Number(amountUSD) : null,
      requiresEnrollment: !!requiresEnrollment,
      updatedAt: new Date(),
    };

    if (typeof enrolled === "boolean") {
      next.enrolled = enrolled;
      next.enrolledAt = enrolled ? new Date() : null;
    }

    if (usedAt === null) {
      next.usedAt = null;
    } else if (typeof usedAt === "string" && usedAt.trim()) {
      const parsed = new Date(usedAt);
      next.usedAt = Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof remindEnabled === "boolean") {
      next.remindEnabled = remindEnabled;
    }

    const col = await getUserBenefitStatesCollection();
    await col.updateOne({ userId, benefitKey }, { $set: next }, { upsert: true });
    const saved = await col.findOne({ userId, benefitKey });

    res.json({
      ok: true,
      state: {
        benefitKey,
        enrolled: !!saved?.enrolled,
        enrolledAt: saved?.enrolledAt ? new Date(saved.enrolledAt).toISOString() : null,
        usedAt: saved?.usedAt ? new Date(saved.usedAt).toISOString() : null,
        remindEnabled: !!saved?.remindEnabled,
        updatedAt: saved?.updatedAt ? new Date(saved.updatedAt).toISOString() : null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to save user benefit state" });
  }
});

router.delete("/user-benefits/state", async (req, res) => {
  try {
    const userId = String(req.query.userId || "devUser").trim() || "devUser";
    const benefitKey = String(req.query.benefitKey || "").trim();
    if (!benefitKey) return res.status(400).json({ error: "benefitKey required" });

    const col = await getUserBenefitStatesCollection();
    const result = await col.deleteOne({ userId, benefitKey });
    res.json({ ok: true, deletedCount: result.deletedCount || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to clear user benefit state" });
  }
});

router.get("/user-benefits/summary", async (req, res) => {
  try {
    const userId = String(req.query.userId || "devUser").trim() || "devUser";
    const manualCardSlugs = parseManualCardSlugs(req.query.manualCardSlugs);

    const benefitCol = await getUserBenefitStatesCollection();
    const states = await benefitCol.find({ userId }).toArray();

    const totalCredits = states.length;
    const unusedCredits = states.filter((state) => !state.usedAt).length;
    const enrolledCredits = states.filter((state) => !!state.enrolled).length;
    const remindersEnabled = states.filter((state) => !!state.remindEnabled).length;
    const openValue = states.reduce((sum, state) => sum + (Number.isFinite(state.amountUSD ?? 0) ? state.amountUSD ?? 0 : 0), 0);
    const topMissedCredits = states
      .filter((state) => !state.usedAt)
      .sort((a, b) => (Number.isFinite(b.amountUSD ?? 0) ? b.amountUSD ?? 0 : 0) - (Number.isFinite(a.amountUSD ?? 0) ? a.amountUSD ?? 0 : 0))
      .slice(0, 3)
      .map((state) => ({
        label: state.label || "Credit",
        cardName: state.cardName || "Card",
        amountUSD: Number.isFinite(state.amountUSD) ? state.amountUSD : 0,
      }));

    const linkedCol = await getLinkedAccountsCollection();
    const linkedDocs = await linkedCol.find({ userId }).toArray();
    const linkedSlugs = new Set<string>();
    linkedDocs.forEach((doc: any) => {
      (doc.accounts || []).forEach((acct: any) => {
        const slug = String(acct?.mappedCardSlug || "").trim();
        if (slug) linkedSlugs.add(slug);
      });
    });
    manualCardSlugs.forEach((slug) => linkedSlugs.add(slug));

    const cardsCol = await getCardsCollection();
    const allCards = await cardsCol.find({}).toArray();
    const linkedCards = allCards.filter((card: any) => card.slug && linkedSlugs.has(card.slug));

    const coveredCategories = new Set<string>();
    linkedCards.forEach((card: any) => {
      const rewards = getRewardsByCategory(card);
      if (rewards && typeof rewards === "object") {
        Object.entries(rewards).forEach(([category, amount]) => {
          const numeric = parseRateValue(amount);
          if (numeric >= 1.5) coveredCategories.add(String(category).toLowerCase());
        });
      }
    });

    const candidateCategories = [
      "travel",
      "dining",
      "groceries",
      "gas",
      "streaming",
      "drugstores",
      "online",
      "rideshare",
      "entertainment",
      "departmentstores",
      "apparel",
    ];
    const missingCategories = candidateCategories.filter((category) => !coveredCategories.has(category)).slice(0, 4);

    const recommendedNextCard = findRecommendedWalletCard(allCards, linkedSlugs, missingCategories);
    const walletHealthScore = Math.max(
      15,
      Math.min(
        100,
        88 - missingCategories.length * 8 - unusedCredits * 2 + enrolledCredits * 4 + (remindersEnabled >= 1 ? 4 : 0)
      )
    );

    res.json({
      userId,
      totalCredits,
      unusedCredits,
      enrolledCredits,
      remindersEnabled,
      openValue,
      missingCategories,
      topMissedCredits,
      recommendedNextCard,
      linkedCardSlugs: Array.from(linkedSlugs),
      walletHealthScore,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to load wallet summary" });
  }
});

function parseManualCardSlugs(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function findRecommendedWalletCard(cards: any[], linkedSlugs: Set<string>, missingCategories: string[]) {
  const candidates = cards.filter((card: any) => card.slug && !linkedSlugs.has(card.slug));
  if (!candidates.length) return null;

  const scored = candidates
    .map((card: any) => {
      const gapValue = missingCategories.reduce((sum, category) => sum + getCategoryRate(getRewardsByCategory(card), category), 0);
      const rewardValues = Object.values(getRewardsByCategory(card) || {}) as unknown[];
      const totalValue = rewardValues.reduce<number>((sum, value) => sum + parseRateValue(value), 0);
      const annualFee = Number.isFinite(card.annualFee) ? Number(card.annualFee) : 0;
      const score = gapValue * 4 + totalValue - annualFee * 0.02;
      return { card, score, gapValue, totalValue };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) return null;
  return {
    slug: best.card.slug,
    name: best.card.name || "Recommended card",
    issuer: best.card.issuer || null,
    annualFee: Number.isFinite(best.card.annualFee) ? best.card.annualFee : null,
    reason: best.gapValue > 0 ? `Fills ${missingCategories.join(", ")} gaps` : "Strong rewards coverage",
  };
}

function getRewardsByCategory(card: any) {
  return card?.benefitsDetail?.rewardsByCategory || card?.rewardsByCategory || null;
}

function parseRateValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(String(value).replace(/[^0-9.]+/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
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

export default router;
