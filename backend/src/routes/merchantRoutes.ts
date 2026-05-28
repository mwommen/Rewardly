import express from "express";
import { getCardsCollection } from "../db";
import { CARD_OVERRIDES } from "../scrapers/overrides/cards";
import { inferMerchantForHost } from "../utils/merchant";
const router = express.Router();

router.get("/merchant/infer", (req, res) => {
  const host = String(req.query.host || "").trim();
  if (!host) return res.status(400).json({ error: "host required" });
  const out = inferMerchantForHost(host);
  return res.json({ host, merchantName: out.name, mcc: out.mcc || null });
});

router.get("/merchant/suggestions", async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit || 16);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 60) : 16;
    const col = await getCardsCollection();
    const cards = await col.find({}).toArray();
    const merged = cards.map((card: any) => {
      const override = card?.slug ? CARD_OVERRIDES[card.slug] : undefined;
      if (!override) return card;
      return {
        ...card,
        name: override.name ?? card.name,
        issuer: override.issuer ?? card.issuer,
        merchantCredits: override.merchantCredits ?? card.merchantCredits,
        recurringCredits: override.recurringCredits ?? card.recurringCredits,
        perks: override.perks ?? card.perks,
      };
    });

    const seenCards = new Set<string>();
    const byMerchant = new Map<string, { merchant: string; cards: Set<string> }>();

    merged.forEach((card: any) => {
      const key = String(card?.slug || card?.name || "").trim();
      if (!key || seenCards.has(key.toLowerCase())) return;
      seenCards.add(key.toLowerCase());

      const merchantSet = new Set<string>();
      extractMerchantsFromCredits(card?.merchantCredits, merchantSet);
      extractMerchantsFromCredits(card?.recurringCredits, merchantSet);
      extractMerchantsFromPerks(card?.perks, merchantSet);

      merchantSet.forEach((merchant) => {
        const normalized = normalizeMerchantName(merchant);
        if (!normalized) return;
        const entry = byMerchant.get(normalized) || { merchant: normalized, cards: new Set<string>() };
        entry.cards.add(String(card?.name || card?.slug || "Card"));
        byMerchant.set(normalized, entry);
      });
    });

    const suggestions = Array.from(byMerchant.values())
      .map((entry) => ({
        merchant: entry.merchant,
        cardCount: entry.cards.size,
        cards: Array.from(entry.cards).slice(0, 3),
      }))
      .sort((a, b) => b.cardCount - a.cardCount || a.merchant.localeCompare(b.merchant))
      .slice(0, limit);

    res.json({ merchants: suggestions });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to build suggestions" });
  }
});

const STOPWORDS = new Set([
  "travel",
  "dining",
  "restaurants",
  "restaurant",
  "rideshare",
  "rideshares",
  "gas",
  "grocery",
  "groceries",
  "streaming",
  "hotels",
  "hotel",
  "flights",
  "airline",
  "airlines",
  "transit",
  "parking",
  "entertainment",
  "online",
  "shopping",
  "statement credit",
  "credit",
  "monthly",
  "annual",
  "points",
  "bonus",
  "cash back",
  "cashback",
  "miles",
  "membership rewards",
  "thankyou points",
  "ultimate rewards",
  "reward",
  "rewards",
]);

const KNOWN_MERCHANTS = [
  "lululemon",
  "uber",
  "uber eats",
  "lyft",
  "doordash",
  "instacart",
  "saks",
  "saks fifth avenue",
  "resy",
  "marriott",
  "delta",
  "southwest",
  "united",
  "american airlines",
  "jetblue",
  "airbnb",
  "expedia",
  "booking.com",
  "hilton",
  "ihg",
  "hyatt",
  "disney+",
  "hulu",
  "espn+",
  "peacock",
  "paramount+",
  "netflix",
  "apple",
  "apple pay",
  "amazon",
  "whole foods",
  "walmart",
  "target",
  "costco",
  "sam's club",
  "spotify",
  "audible",
  "chewy",
  "nike",
];

function extractMerchantsFromCredits(
  credits: Array<{ label?: string; name?: string; eligibleWhen?: { merchantPatterns?: string[] } }> | undefined,
  out: Set<string>
) {
  if (!Array.isArray(credits)) return;
  credits.forEach((credit) => {
    const label = `${credit?.label || ""} ${credit?.name || ""}`.trim();
    if (label) {
      extractMerchantsFromText(label, out);
    }
    const patterns = credit?.eligibleWhen?.merchantPatterns || [];
    patterns.forEach((pattern) => {
      String(pattern || "")
        .split("|")
        .map((p) => p.replace(/[\\^$.*+?()[\]{}]/g, "").trim())
        .filter(Boolean)
        .forEach((p) => extractMerchantsFromText(p, out));
    });
  });
}

function extractMerchantsFromPerks(perks: string[] | undefined, out: Set<string>) {
  if (!Array.isArray(perks)) return;
  perks.forEach((perk) => {
    if (!perk) return;
    extractMerchantsFromText(String(perk), out);
  });
}

function extractMerchantsFromText(text: string, out: Set<string>) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const matches = cleaned.match(/\b(?:at|on|for)\s+([A-Za-z0-9&.'-]+(?:\s+[A-Za-z0-9&.'-]+){0,2})/gi) || [];
  matches.forEach((m) => {
    const name = m.replace(/^(at|on|for)\s+/i, "").trim();
    if (name.length >= 3) out.add(name);
  });
  const direct = cleaned.match(/[A-Za-z0-9&.'-]{3,}(?:\s+[A-Za-z0-9&.'-]{3,}){0,2}/g) || [];
  direct.forEach((m) => {
    if (m.length >= 3) out.add(m);
  });
  addKnownMerchants(cleaned, out);
}

function normalizeMerchantName(name: string) {
  let n = String(name || "").trim().toLowerCase();
  if (!n) return "";
  n = n.replace(/\s+/g, " ").replace(/®|™/g, "");
  if (/^\d+$/.test(n)) return "";
  if (/\b(points|bonus|cash back|cashback|miles|rewards)\b/.test(n)) return "";
  if (STOPWORDS.has(n)) return "";
  if (n.length < 3) return "";
  return n;
}

function addKnownMerchants(text: string, out: Set<string>) {
  const lower = text.toLowerCase();
  KNOWN_MERCHANTS.forEach((merchant) => {
    if (lower.includes(merchant)) out.add(merchant);
  });
}

export default router;
