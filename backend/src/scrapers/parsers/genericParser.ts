// src/scrapers/parsers/genericParser.ts
import type { BenefitsPayload } from "./index";
import { sanitizeTextForParsing } from "./textParsers";

export function parseGeneric(text: string, url?: string): BenefitsPayload {
  const cleanedText = sanitizeTextForParsing(text);
  const perks: string[] = [];
  const recurringCredits: NonNullable<BenefitsPayload["recurringCredits"]> = [];
  const merchantCredits: NonNullable<BenefitsPayload["merchantCredits"]> = [];
  const seenCredits = new Set<string>();

  type MerchantPeriod = NonNullable<BenefitsPayload["merchantCredits"]>[number]["period"];
  type RecurringPeriod = NonNullable<BenefitsPayload["recurringCredits"]>[number]["period"];
  const periodMap: Record<string, MerchantPeriod> = {
    month: "month",
    monthly: "month",
    quarter: "quarter",
    quarterly: "quarter",
    "semi-annual": "semi-annual",
    semiannual: "semi-annual",
    year: "year",
    yearly: "year",
    annual: "year",
    "per year": "year",
    "per calendar year": "year",
  };

  const moneyRegex =
    /(?:\$|\\u0024)\s*([0-9]+(?:\.[0-9]+)?)/i;

  function normalizeCreditKey(label: string, amountUSD: number, period: string): string {
    const base = label
      .toLowerCase()
      .replace(/\benrollment required\b/gi, "")
      .replace(/\bu\.?s\.?\b/gi, "")
      .replace(/locations?|stores?/gi, "")
      .replace(/statement credit|credit/gi, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return `${amountUSD}|${period}|${base}`;
  }

  function normalizeMerchantPatterns(raw: string): string[] {
    const cleaned = raw
      .toLowerCase()
      .replace(/\bu\.?s\.?\b/g, "")
      .replace(/\b(locations?|stores?)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const stopwords = new Set([
      "any",
      "time",
      "without",
      "notice",
      "checkout",
      "qualifying",
      "charges",
      "credit",
      "statement",
      "purchase",
      "single",
      "part",
      "whole",
      "over",
      "may",
      "used",
      "the",
      "for",
      "to",
      "up",
      "by",
    ]);
    const tokens = cleaned
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !stopwords.has(t));
    const joined = tokens.join(" ");
    const out = new Set<string>();
    if (joined) out.add(joined);
    tokens.forEach((t) => out.add(t));
    return [...out];
  }

  function addMerchantCredit(input: {
    label: string;
    amountUSD: number;
    period: MerchantPeriod;
    patterns: string[];
    requiresEnrollment?: boolean;
  }) {
    const key = normalizeCreditKey(input.label, input.amountUSD, input.period);
    if (seenCredits.has(key)) return;
    seenCredits.add(key);
    merchantCredits.push({
      id: `generic-merchant-${merchantCredits.length + 1}`,
      label: input.label,
      amountUSD: input.amountUSD,
      period: input.period,
      capPerPeriodUSD: input.amountUSD,
      eligibleWhen: { merchantPatterns: input.patterns },
      requiresEnrollment: !!input.requiresEnrollment,
      sourceUrl: url,
      confidence: 0.45,
    });
  }

  function addRecurringCredit(input: {
    label: string;
    amountUSD: number;
    period: RecurringPeriod;
    requiresEnrollment?: boolean;
  }) {
    const key = normalizeCreditKey(input.label, input.amountUSD, input.period);
    if (seenCredits.has(key)) return;
    seenCredits.add(key);
    recurringCredits.push({
      id: `generic-recurring-${recurringCredits.length + 1}`,
      label: input.label,
      amountUSD: input.amountUSD,
      period: input.period,
      requiresEnrollment: !!input.requiresEnrollment,
      sourceUrl: url,
      confidence: 0.45,
    });
  }

  const statementAtRegex =
    /(?:\$|\\u0024)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:in\s*)?(monthly|quarterly|semi-annual|semiannual|annual|yearly|per\s+month|per\s+quarter|per\s+year|per\s+calendar\s+year)?\s*statement\s*credits?[\s\S]{0,140}?\bat\s+([A-Za-z0-9&'’\-\.\s]{2,80})/gi;

  for (const m of cleanedText.matchAll(statementAtRegex)) {
    const amount = Number(m[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const periodToken = (m[2] || "year").toLowerCase().replace(/\s+/g, " ").trim();
    const period = periodMap[periodToken] || "year";
    const merchantRaw = m[3].trim();
    const patterns = normalizeMerchantPatterns(merchantRaw);
    if (!patterns.length) continue;
    const label = `$${amount} statement credit at ${merchantRaw.replace(/\s+/g, " ").trim()}`;
    addMerchantCredit({ label, amountUSD: amount, period, patterns, requiresEnrollment: true });
  }

  for (const lineRaw of cleanedText.split(/\n+/)) {
    const line = lineRaw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (line.length > 240) continue;

    if (
      /warranty|protection|extended|no foreign|lounge|priority pass|insurance|baggage|rental car/i.test(line) &&
      line.length > 20
    ) {
      perks.push(line);
    }

    if (!/credit|statement|reimbursement|membership/i.test(line)) continue;

    const m = line.match(moneyRegex);
    if (!m) continue;
    const amount = Number(m[1]);
    if (!Number.isFinite(amount) || amount < 5) continue;

    const periodMatch = line.match(/per\s+month|monthly|per\s+quarter|quarterly|semi-annual|semiannual|annual|yearly|per\s+year|per\s+calendar\s+year/i);
    const periodToken = periodMatch ? periodMatch[0].toLowerCase().replace(/\s+/g, " ") : "year";
    const period = periodMap[periodToken] || "year";

    const merchantMatch = line.match(/\bat\s+([A-Za-z0-9&'’\-\.\s]{2,80})/i);
    const requiresEnrollment = /enroll|enrollment/i.test(line);

    if (merchantMatch) {
      const merchantRaw = merchantMatch[1].trim();
      const patterns = normalizeMerchantPatterns(merchantRaw);
      if (patterns.length) {
        const label = line.slice(0, 160);
        addMerchantCredit({ label, amountUSD: amount, period, patterns, requiresEnrollment });
        continue;
      }
    }

    addRecurringCredit({
      label: line.slice(0, 160),
      amountUSD: amount,
      period,
      requiresEnrollment,
    });
  }

  return {
    perks: Array.from(new Set(perks)).slice(0, 30),
    merchantCredits,
    recurringCredits,
    sourceUrl: url,
    confidence: 0.5,
  };
}
