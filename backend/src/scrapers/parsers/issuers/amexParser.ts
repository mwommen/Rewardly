// backend/src/scrapers/parsers/issuers/amexParser.ts
import type { BenefitsPayload, RewardsArrayEntry } from "../index";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import * as cheerio from "cheerio";

type Rules = {
  period_tokens?: Record<string, string>;
  merchant_aliases?: Record<string, string[]>;
  issuer_patterns?: {
    amex?: {
      recurring?: {
        match: string;
        label: string;
        amountUSD: number;
        period: string;
        partner?: string;
        requiresEnrollment?: boolean;
      }[];
      merchant_credits?: {
        match: string;
        label: string;
        amountUSD: number;
        period: string;
        merchantKey: string;
        requiresEnrollment?: boolean;
      }[];
    };
  };
};

let RULES: Rules = {};
(function loadRules() {
  try {
    // ../../rules/benefit_patterns.yaml
    const rulesPath = path.join(__dirname, "..", "..", "rules", "benefit_patterns.yaml");
    const raw = fs.readFileSync(rulesPath, "utf8");
    RULES = yaml.load(raw) as Rules;
  } catch {
    RULES = {};
  }
})();

// --- helpers: normalize input so regexes hit both visible text *and* inline JSON/HTML ---
function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&dollar;|&#36;/gi, "$")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    // 👇 important for Next/JSON blobs: "\u0024" → "$"
    .replace(/\\u0024/gi, "$");
}

/**
 * Combine: visible text (from Cheerio) + raw HTML (lowercased) so YAML regex can
 * match either human-visible copy or JSON blobs in <script> tags.
 */
function buildSearchable(input: string): string {
  const raw = input || "";
  let visible = raw;

  if (/<[a-z][\s\S]*>/i.test(raw)) {
    try {
      const $ = cheerio.load(raw);
      // Get *visible* text
      visible = $.root().text();
    } catch {
      visible = raw;
    }
  }

  const decodedVisible = decodeEntities(visible);
  const normVisible = decodedVisible.replace(/\s+/g, " ").trim();
  // Also search the raw HTML (lowercased) because benefits often live in Next.js data blobs
  const decodedRaw = decodeEntities(raw);
  const normHtml = decodedRaw.toLowerCase();
  const strippedHtml = decodedRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // Keep it manageable (just in case): cap the HTML portion length
  const htmlSlice = normHtml.length > 1_200_000 ? normHtml.slice(0, 1_200_000) : normHtml;

  // Return a single big haystack
  return `${normVisible}\n${strippedHtml}\n${htmlSlice}`;
}

export function parseAmex(textOrHtml: string, url?: string): BenefitsPayload {
  const haystack = buildSearchable(textOrHtml);
  const rawDecoded = decodeEntities(textOrHtml);
  const rewardHaystack = haystack
    .replace(/\\\"/g, '"')
    .replace(/\\u0026#8225;/gi, " ")
    .replace(/[\\[\\]{}"]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const out: BenefitsPayload = { sourceUrl: url, confidence: 0.7, perks: [] };

  // debug logging removed

  // Recurring credits
  const rr: NonNullable<BenefitsPayload["recurringCredits"]> = [];
  for (const r of RULES.issuer_patterns?.amex?.recurring || []) {
    const re = new RegExp(r.match, "i");
    if (re.test(haystack)) {
      rr.push({
        id: `amex-recurring-${rr.length + 1}`,
        label: r.label,
        amountUSD: r.amountUSD,
        period: (r.period as any) || "year",
        partner: r.partner,
        requiresEnrollment: !!r.requiresEnrollment,
        sourceUrl: url,
        confidence: 0.9,
      });
    }
  }
  if (rr.length) out.recurringCredits = rr;

  // Merchant credits (e.g., Lululemon, Saks)
  const mc: NonNullable<BenefitsPayload["merchantCredits"]> = [];
  for (const r of RULES.issuer_patterns?.amex?.merchant_credits || []) {
    const re = new RegExp(r.match, "i");
    if (re.test(haystack)) {
      const patterns =
        RULES.merchant_aliases?.[r.merchantKey]?.length
          ? RULES.merchant_aliases![r.merchantKey]
          : [r.merchantKey];

      mc.push({
        id: `amex-merchant-${mc.length + 1}`,
        label: r.label,
        amountUSD: r.amountUSD,
        period: (r.period as any) || "year",
        capPerPeriodUSD: r.amountUSD,
        eligibleWhen: { merchantPatterns: patterns },
        requiresEnrollment: !!r.requiresEnrollment,
        sourceUrl: url,
        confidence: 0.92,
      });
    }
  }
  if (mc.length) out.merchantCredits = mc;

  // Rewards parsing (capture rate, unit, category, caps)
  const rewards: RewardsArrayEntry[] = [];
  const seen = new Set<string>();

  function pushReward(entry: RewardsArrayEntry) {
    const key = `${entry.rate}|${entry.unit}|${entry.keys.join(",")}|${entry.capPerPeriodUSD || ""}|${
      entry.period || ""
    }`;
    if (seen.has(key)) return;
    seen.add(key);
    rewards.push(entry);
  }

  function normalizeCategory(raw: string): string {
    const s = raw
      .toLowerCase()
      .replace(/membership rewards|points|miles|per dollar|per \$|dollars?/g, "")
      .replace(/worldwide|u\\.s\\.?|us\\b|eligible|purchases?/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/restaurant|dining/.test(s)) return "restaurants";
    if (/supermarket|grocery/.test(s)) return "groceries";
    if (/airline|flight|airfare/.test(s)) return "airfare";
    if (/hotel/.test(s)) return "hotels";
    if (/travel/.test(s)) return "travel";
    if (/gas/.test(s)) return "gas";
    if (/transit/.test(s)) return "transit";
    if (/ride|rideshare|uber|lyft/.test(s)) return "rideshare";
    if (/streaming|digital entertainment/.test(s)) return "streaming";
    if (/online/.test(s)) return "online";
    if (/department/.test(s)) return "departmentstores";
    return s || "other";
  }

  function extractCap(context: string): { capPerPeriodUSD?: number; period?: any } {
    const capMatch = context.match(/up to\\s*(?:\\$|\\u0024)?\\s*([0-9.,]+)\\s*([kKmM])?/i);
    if (!capMatch) return {};
    let cap = Number((capMatch[1] || "").replace(/,/g, ""));
    const suffix = (capMatch[2] || "").toLowerCase();
    if (Number.isFinite(cap) && suffix === "k") cap *= 1000;
    if (Number.isFinite(cap) && suffix === "m") cap *= 1000000;
    if (!Number.isFinite(cap)) return {};
    let period: any = undefined;
    if (/per\\s*month|monthly/i.test(context)) period = "month";
    else if (/per\\s*quarter|quarterly/i.test(context)) period = "quarter";
    else if (/semi-annual|per\\s*six\\s*months|twice\\s*per\\s*year/i.test(context)) period = "semi-annual";
    else if (/per\\s*year|annual|calendar\\s*year/i.test(context)) period = "year";
    return { capPerPeriodUSD: cap, period };
  }

  function detectUnit(context: string, symbol: string): "cash" | "points" | "miles" {
    if (/%/.test(symbol) || /cash\\s*back|cashback/i.test(context)) return "cash";
    if (/miles/i.test(context)) return "miles";
    return "points";
  }

  const rewardRegexes = [
    /(?:earn|get)\\s+(\\d+(?:\\.\\d+)?)\\s*(x|X|%)\\s*[\\s\\S]{0,80}?(?:points|miles|cash\\s*back|cashback)?[\\s\\S]{0,40}?(?:at|on|for)\\s+([^\\.\\n;]{3,80})/gi,
    /(\\d+(?:\\.\\d+)?)\\s*(x|X|%)\\s*[\\s\\S]{0,40}?(?:points|miles|cash\\s*back|cashback)?[\\s\\S]{0,30}?(?:at|on|for)\\s+([^\\.\\n;]{3,80})/gi,
  ];

  for (const re of rewardRegexes) {
    for (const m of rewardHaystack.matchAll(re)) {
      const rate = m[1];
      const symbol = m[2];
      const rawCat = m[3] || "";
      const index = m.index ?? 0;
      const context = rewardHaystack.slice(index, index + 240);
      const category = normalizeCategory(rawCat);
      const unit = detectUnit(context, symbol);
      const cap = extractCap(context);
      const key = `${rate}|${symbol}|${unit}|${category}|${cap.capPerPeriodUSD || ""}|${cap.period || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      pushReward({
        keys: [category],
        rate: symbol === "%" ? `${rate}%` : `${rate}x`,
        unit,
        capPerPeriodUSD: cap.capPerPeriodUSD,
        period: cap.period,
        sourceUrl: url,
        confidence: 0.7,
      });
    }
  }

  const pointsAtCapRegex =
    /(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?[\s\S]{0,120}?at\s+([^,\n.]{3,120}),[\s\S]{0,120}?up to\\s*(?:\\$|\\u0024)?\\s*([0-9.,]+)\\s*([kKmM])?[\s\\S]{0,80}?(?:per|a)\\s*(?:calendar\\s*)?year/gi;
  for (const m of rewardHaystack.matchAll(pointsAtCapRegex)) {
    const rate = m[1];
    const rawCat = m[2] || "";
    const capRaw = m[3] || "";
    const capSuffix = (m[4] || "").toLowerCase();
    let cap = Number(capRaw.replace(/,/g, ""));
    if (Number.isFinite(cap) && capSuffix === "k") cap *= 1000;
    if (Number.isFinite(cap) && capSuffix === "m") cap *= 1000000;

    pushReward({
      keys: [normalizeCategory(rawCat)],
      rate: `${rate}x`,
      unit: "points",
      capPerPeriodUSD: Number.isFinite(cap) ? cap : undefined,
      period: "year",
      sourceUrl: url,
      confidence: 0.8,
    });
  }

  const pointsAtRegex = /(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?[\s\S]{0,80}?at\s+([^,\n.]{3,120})/gi;
  for (const m of rewardHaystack.matchAll(pointsAtRegex)) {
    const rate = m[1];
    const rawCat = m[2] || "";
    const index = m.index ?? 0;
    const context = rewardHaystack.slice(index, index + 220);
    const category = normalizeCategory(rawCat);
    const cap = extractCap(context);
    pushReward({
      keys: [category],
      rate: `${rate}x`,
      unit: "points",
      capPerPeriodUSD: cap.capPerPeriodUSD,
      period: cap.period,
      sourceUrl: url,
      confidence: 0.78,
    });
  }

  // Targeted Amex Gold patterns
  const goldPatterns: Array<{ re: RegExp; category: string; rate: string }> = [
    { re: /(?:4x|4\\s*x|4×)[\\s\\S]{0,200}restaurants?/i, category: "restaurants", rate: "4x" },
    { re: /(?:4x|4\\s*x|4×)[\\s\\S]{0,240}u\\.s\\.?\\s*supermarkets?/i, category: "groceries", rate: "4x" },
    { re: /(?:3x|3\\s*x|3×)[\\s\\S]{0,240}(flights|airlines|amex\\s*travel)/i, category: "airfare", rate: "3x" },
    { re: /(?:2x|2\\s*x|2×)[\\s\\S]{0,240}amex\\s*travel/i, category: "travel", rate: "2x" },
    { re: /(?:1x|1\\s*x|1×)[\\s\\S]{0,200}(other|eligible)\\s*purchases?/i, category: "other", rate: "1x" },
  ];

  for (const p of goldPatterns) {
    if (p.re.test(haystack)) {
      pushReward({
        keys: [p.category],
        rate: p.rate,
        unit: "points",
        sourceUrl: url,
        confidence: 0.75,
      });
    }
  }

  // Parse JSON "header" fields directly (where Amex stores reward copy)
  const headerRegex = /\\?"header\\?",\\?"([^\\"]{10,240})\\?"/gi;
  for (const m of rawDecoded.matchAll(headerRegex)) {
    const headerRaw = m[1] || "";
    const headerText = headerRaw
      .replace(/\\"/g, '"')
      .replace(/\\u003c/gi, "<")
      .replace(/\\u003e/gi, ">")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!headerText) continue;

    const capMatch = headerText.match(/up to\s*\$?\s*([0-9.,]+)\s*([kKmM])?/i);
    let cap: number | undefined;
    if (capMatch) {
      cap = Number((capMatch[1] || "").replace(/,/g, ""));
      const suffix = (capMatch[2] || "").toLowerCase();
      if (Number.isFinite(cap) && suffix === "k") cap *= 1000;
      if (Number.isFinite(cap) && suffix === "m") cap *= 1000000;
    }

    const atMatch = headerText.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?\s*at\s+([^,]+?)(?:,|$)/i);
    if (atMatch) {
      pushReward({
        keys: [normalizeCategory(atMatch[2] || "")],
        rate: `${atMatch[1]}x`,
        unit: "points",
        capPerPeriodUSD: Number.isFinite(cap!) ? cap : undefined,
        period: capMatch ? "year" : undefined,
        sourceUrl: url,
        confidence: 0.85,
      });
      continue;
    }

    const onMatch = headerText.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?\s*on\s+([^,]+?)(?:,|$)/i);
    if (onMatch) {
      pushReward({
        keys: [normalizeCategory(onMatch[2] || "")],
        rate: `${onMatch[1]}x`,
        unit: "points",
        capPerPeriodUSD: Number.isFinite(cap!) ? cap : undefined,
        period: capMatch ? "year" : undefined,
        sourceUrl: url,
        confidence: 0.82,
      });
    }
  }

  const escapedHeaderRegex = /\\\"header\\\",\\\"([^\\\"]{10,240})\\\"/gi;
  for (const m of rawDecoded.matchAll(escapedHeaderRegex)) {
    const headerRaw = m[1] || "";
    const headerText = headerRaw
      .replace(/\\"/g, '"')
      .replace(/\\u003c/gi, "<")
      .replace(/\\u003e/gi, ">")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!headerText) continue;

    const capMatch = headerText.match(/up to\s*\$?\s*([0-9.,]+)\s*([kKmM])?/i);
    let cap: number | undefined;
    if (capMatch) {
      cap = Number((capMatch[1] || "").replace(/,/g, ""));
      const suffix = (capMatch[2] || "").toLowerCase();
      if (Number.isFinite(cap) && suffix === "k") cap *= 1000;
      if (Number.isFinite(cap) && suffix === "m") cap *= 1000000;
    }

    const atMatch = headerText.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?\s*at\s+([^,]+?)(?:,|$)/i);
    if (atMatch) {
      pushReward({
        keys: [normalizeCategory(atMatch[2] || "")],
        rate: `${atMatch[1]}x`,
        unit: "points",
        capPerPeriodUSD: Number.isFinite(cap!) ? cap : undefined,
        period: capMatch ? "year" : undefined,
        sourceUrl: url,
        confidence: 0.86,
      });
      continue;
    }

    const onMatch = headerText.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?\s*on\s+([^,]+?)(?:,|$)/i);
    if (onMatch) {
      pushReward({
        keys: [normalizeCategory(onMatch[2] || "")],
        rate: `${onMatch[1]}x`,
        unit: "points",
        capPerPeriodUSD: Number.isFinite(cap!) ? cap : undefined,
        period: capMatch ? "year" : undefined,
        sourceUrl: url,
        confidence: 0.84,
      });
    }
  }

  // Directly parse inline header snippets from the normalized reward haystack
  const headerInlineRegex = /header","([^"]{10,240})"/gi;
  for (const m of rewardHaystack.matchAll(headerInlineRegex)) {
    const headerText = (m[1] || "").replace(/\s+/g, " ").trim();
    if (!headerText) continue;
    const cap = extractCap(headerText);
    const atMatch = headerText.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?\s*(?:at|on)\s+([^,]+?)(?:,|$)/i);
    if (!atMatch) continue;

    pushReward({
      keys: [normalizeCategory(atMatch[2] || "")],
      rate: `${atMatch[1]}x`,
      unit: "points",
      capPerPeriodUSD: cap.capPerPeriodUSD,
      period: cap.period,
      sourceUrl: url,
      confidence: 0.85,
    });
  }

  // Fallback: parse header blocks from normalized reward haystack
  const headerTextRegex = /header\s*[, ]\s*(\d+\s*(?:x|×)\s*points?[^"]{0,180})/gi;
  for (const m of rewardHaystack.matchAll(headerTextRegex)) {
    const headerText = (m[1] || "").replace(/\s+/g, " ").trim();
    if (!headerText) continue;
    const cap = extractCap(headerText);
    const atMatch = headerText.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*points?\s*(?:at|on)\s+([^,]+?)(?:,|$)/i);
    if (!atMatch) continue;

    pushReward({
      keys: [normalizeCategory(atMatch[2] || "")],
      rate: `${atMatch[1]}x`,
      unit: "points",
      capPerPeriodUSD: cap.capPerPeriodUSD,
      period: cap.period,
      sourceUrl: url,
      confidence: 0.8,
    });
  }

  if (rewards.length) out.rewardsByCategory = rewards;

  // Perks (kept conservative)
  out.perks = haystack
    .split(/[•–—.]/)
    .map((s) => s.trim())
    .filter((s) =>
      /lounge|CLEAR|Priority Pass|Global Entry|purchase protection|extended warranty|no foreign/i.test(s)
    )
    .slice(0, 30);

  return out;
}
