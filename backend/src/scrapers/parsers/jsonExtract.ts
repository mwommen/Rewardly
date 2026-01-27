import type { BenefitsPayload, Period } from "../../models/benefits";

type JsonCollectOptions = {
  keyRegex: RegExp;
  valueRegex: RegExp;
  max?: number;
};

export type IssuerJsonMap = {
  labelKeys: string[];
  descriptionKeys: string[];
  amountKeys: string[];
  periodKeys: string[];
  merchantKeys: string[];
  enrollmentKeys: string[];
  rewardKeys?: string[];
  creditKeywords?: RegExp;
  perkKeywords?: RegExp;
};

function tryParseJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 20_000_000) return null;

  const strippedPrefix = trimmed
    .replace(/^\)\]\}',?\s*/g, "")
    .replace(/^while\(1\);\s*/g, "")
    .replace(/^for\s*\(\s*;;\s*\)\s*;\s*/g, "")
    .replace(/^\/\*\s*secure\s*\*\/\s*/gi, "")
    .trim();

  const candidate = strippedPrefix;
  if (candidate.startsWith("{") || candidate.startsWith("[")) {
    if (!(candidate.endsWith("}") || candidate.endsWith("]"))) {
      return null;
    }
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  const firstBrace = candidate.indexOf("{");
  const firstBracket = candidate.indexOf("[");
  let start = -1;
  if (firstBrace >= 0 && firstBracket >= 0) start = Math.min(firstBrace, firstBracket);
  else start = Math.max(firstBrace, firstBracket);
  if (start < 0) return null;
  const endBrace = candidate.lastIndexOf("}");
  const endBracket = candidate.lastIndexOf("]");
  const end = Math.max(endBrace, endBracket);
  if (end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function extractJsonBlobs(text: string): unknown[] {
  const blobs: unknown[] = [];
  const seen = new Set<string>();
  const maxBlobs = 40;

  function pushBlob(raw: string) {
    if (blobs.length >= maxBlobs) return;
    const parsed = tryParseJson(raw);
    if (!parsed) return;
    const sig = raw.slice(0, 200);
    if (seen.has(sig)) return;
    seen.add(sig);
    blobs.push(parsed);
  }

  const scriptRegexes = [
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi,
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    /<script[^>]*>[\s\S]*?__NUXT__\s*=\s*({[\s\S]*?})\s*;?[\s\S]*?<\/script>/gi,
    /<script[^>]*>[\s\S]*?__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*;?[\s\S]*?<\/script>/gi,
  ];

  for (const rx of scriptRegexes) {
    for (const match of text.matchAll(rx)) {
      pushBlob(match[1]);
    }
  }

  const assignmentRegexes = [
    /__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;?/gi,
    /__NUXT__\s*=\s*({[\s\S]*?})\s*;?/gi,
    /__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*;?/gi,
  ];
  for (const rx of assignmentRegexes) {
    for (const match of text.matchAll(rx)) {
      pushBlob(match[1]);
    }
  }

  for (const chunk of text.split(/\n{2,}/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    pushBlob(trimmed);
    if (blobs.length >= maxBlobs) break;
  }

  return blobs;
}

export function collectStringsFromJson(
  blobs: unknown[],
  { keyRegex, valueRegex, max = 200 }: JsonCollectOptions
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function addValue(value: string) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    if (!valueRegex.test(cleaned)) return;
    if (seen.has(cleaned.toLowerCase())) return;
    seen.add(cleaned.toLowerCase());
    out.push(cleaned);
  }

  function walk(node: unknown, key?: string) {
    if (out.length >= max) return;
    if (typeof node === "string") {
      if (!key || keyRegex.test(key) || valueRegex.test(node)) {
        addValue(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, key);
        if (out.length >= max) break;
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (typeof v === "string") {
          if (keyRegex.test(k) || valueRegex.test(v)) addValue(v);
        } else {
          walk(v, k);
        }
        if (out.length >= max) break;
      }
    }
  }

  for (const blob of blobs) {
    walk(blob);
    if (out.length >= max) break;
  }

  return out;
}

type HtmlCollectOptions = {
  max?: number;
  contentTypeRegex?: RegExp;
};

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function collectHtmlValuesFromJson(
  blobs: unknown[],
  { max = 200, contentTypeRegex = /html/i }: HtmlCollectOptions = {}
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function addValue(value: string) {
    const cleaned = stripHtml(value);
    if (!cleaned || cleaned.length < 12) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  }

  function walk(node: unknown) {
    if (out.length >= max) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
        if (out.length >= max) break;
      }
      return;
    }
    if (!node || typeof node !== "object") return;

    const entry = node as Record<string, unknown>;
    const contentType = typeof entry.contentType === "string" ? entry.contentType : "";
    const value = typeof entry.value === "string" ? entry.value : "";
    if (contentType && value && contentTypeRegex.test(contentType)) {
      addValue(value);
    }

    for (const v of Object.values(entry)) {
      walk(v);
      if (out.length >= max) break;
    }
  }

  for (const blob of blobs) {
    walk(blob);
    if (out.length >= max) break;
  }

  return out;
}

export function mergeBenefitsPayload(
  base: BenefitsPayload,
  extra: BenefitsPayload
): BenefitsPayload {
  const perks = dedupeStrings([...(base.perks || []), ...(extra.perks || [])]);
  const merchantCredits = dedupeCredits([...(base.merchantCredits || []), ...(extra.merchantCredits || [])]);
  const recurringCredits = dedupeCredits([...(base.recurringCredits || []), ...(extra.recurringCredits || [])]);
  const rewardsRotating = [...(base.rewardsRotating || []), ...(extra.rewardsRotating || [])];

  return {
    ...base,
    ...extra,
    perks: perks.length ? perks : base.perks,
    merchantCredits: merchantCredits.length ? merchantCredits : base.merchantCredits,
    recurringCredits: recurringCredits.length ? recurringCredits : base.recurringCredits,
    rewardsRotating: rewardsRotating.length ? rewardsRotating : base.rewardsRotating,
    signupOffer: base.signupOffer ?? extra.signupOffer ?? null,
    confidence: Math.max(base.confidence || 0, extra.confidence || 0),
    sourceUrl: base.sourceUrl || extra.sourceUrl,
  };
}

function dedupeStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function dedupeCredits<T extends { label: string; amountUSD: number; period: string }>(credits: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const credit of credits) {
    const key = `${credit.label}|${credit.amountUSD}|${credit.period}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(credit);
  }
  return out;
}

const periodAliases: Record<string, Period> = {
  month: "month",
  monthly: "month",
  quarter: "quarter",
  quarterly: "quarter",
  "semi-annual": "semi-annual",
  semiannual: "semi-annual",
  year: "year",
  yearly: "year",
  annual: "year",
};

function normalizeString(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const numericMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  const moneyMatch = trimmed.match(/(?:\$|\\u0024)\s*([0-9]+(?:\.[0-9]+)?)/i);
  const dollarWordMatch = trimmed.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:dollars?|usd)\b/i);
  const match = moneyMatch || dollarWordMatch || numericMatch;
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAmountFromText(text: string): number | null {
  const match = text.match(/(?:\$|\\u0024)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferPeriodFromKey(key: string): Period | null {
  const lower = key.toLowerCase();
  if (lower.includes("month")) return "month";
  if (lower.includes("quarter")) return "quarter";
  if (lower.includes("semi")) return "semi-annual";
  if (lower.includes("year") || lower.includes("annual")) return "year";
  return null;
}

function normalizePeriod(value: unknown, keyHint?: string): Period {
  if (typeof value === "string") {
    const token = value.toLowerCase().replace(/\s+/g, " ").trim();
    for (const [alias, period] of Object.entries(periodAliases)) {
      if (token.includes(alias)) return period;
    }
  }
  if (keyHint) {
    const inferred = inferPeriodFromKey(keyHint);
    if (inferred) return inferred;
  }
  return "year";
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

function extractMerchantFromText(text: string): string | null {
  const match = text.match(/\bat\s+([A-Za-z0-9&'’\-\.\s]{2,80})/i);
  if (!match) return null;
  return normalizeString(match[1]);
}

export function extractIssuerBenefitsFromJson(
  blobs: unknown[],
  map: IssuerJsonMap,
  url?: string
): BenefitsPayload {
  const perks: string[] = [];
  const merchantCredits: NonNullable<BenefitsPayload["merchantCredits"]> = [];
  const recurringCredits: NonNullable<BenefitsPayload["recurringCredits"]> = [];
  const seenPerks = new Set<string>();
  const seenCredits = new Set<string>();

  const creditKeywords = map.creditKeywords ?? /(credit|statement|reimbursement|membership)/i;
  const perkKeywords =
    map.perkKeywords ??
    /(benefit|perk|feature|reward|points|miles|cash back|cashback|travel|dining|grocery|gas|airport|lounge|insurance|protection)/i;

  type MerchantPeriod = NonNullable<BenefitsPayload["merchantCredits"]>[number]["period"];
  type RecurringPeriod = NonNullable<BenefitsPayload["recurringCredits"]>[number]["period"];

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

  function addPerk(text: string) {
    const cleaned = normalizeString(text);
    if (!cleaned || cleaned.length < 20 || cleaned.length > 220) return;
    if (!perkKeywords.test(cleaned)) return;
    const key = cleaned.toLowerCase();
    if (seenPerks.has(key)) return;
    seenPerks.add(key);
    perks.push(cleaned);
  }

  function addMerchantCredit(input: {
    label: string;
    amountUSD: number;
    period: MerchantPeriod;
    merchant: string;
    requiresEnrollment?: boolean;
  }) {
    const patterns = normalizeMerchantPatterns(input.merchant);
    if (!patterns.length) {
      addRecurringCredit({
        label: input.label,
        amountUSD: input.amountUSD,
        period: input.period,
        requiresEnrollment: input.requiresEnrollment,
      });
      return;
    }
    const key = normalizeCreditKey(input.label, input.amountUSD, input.period);
    if (seenCredits.has(key)) return;
    seenCredits.add(key);
    merchantCredits.push({
      id: `json-merchant-${merchantCredits.length + 1}`,
      label: input.label,
      amountUSD: input.amountUSD,
      period: input.period,
      capPerPeriodUSD: input.amountUSD,
      eligibleWhen: { merchantPatterns: patterns },
      requiresEnrollment: !!input.requiresEnrollment,
      sourceUrl: url,
      confidence: 0.75,
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
      id: `json-recurring-${recurringCredits.length + 1}`,
      label: input.label,
      amountUSD: input.amountUSD,
      period: input.period,
      requiresEnrollment: !!input.requiresEnrollment,
      sourceUrl: url,
      confidence: 0.7,
    });
  }

  function resolveEnrollment(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return /required|yes|true|enroll|opt in/i.test(value);
    return false;
  }

  function walk(node: unknown) {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;

    const entry = node as Record<string, unknown>;
    let label: string | null = null;
    let description: string | null = null;
    let amountValue: number | null = null;
    let periodValue: Period | null = null;
    let merchant: string | null = null;
    let requiresEnrollment = false;
    let amountKeyHint: string | undefined;

    for (const [rawKey, rawValue] of Object.entries(entry)) {
      const key = rawKey.toLowerCase();
      if (map.labelKeys.some((k) => key === k.toLowerCase()) && typeof rawValue === "string") {
        label ??= normalizeString(rawValue);
      }
      if (map.descriptionKeys.some((k) => key === k.toLowerCase()) && typeof rawValue === "string") {
        description ??= normalizeString(rawValue);
      }
      if (map.rewardKeys?.some((k) => key === k.toLowerCase()) && typeof rawValue === "string") {
        addPerk(rawValue);
      }
      if (map.amountKeys.some((k) => key === k.toLowerCase())) {
        const parsed = parseAmount(rawValue);
        if (parsed && parsed > 0) {
          amountValue ??= parsed;
          amountKeyHint ??= key;
        }
      }
      if (map.periodKeys.some((k) => key === k.toLowerCase())) {
        periodValue ??= normalizePeriod(rawValue);
      }
      if (map.merchantKeys.some((k) => key === k.toLowerCase()) && typeof rawValue === "string") {
        merchant ??= normalizeString(rawValue);
      }
      if (map.enrollmentKeys.some((k) => key === k.toLowerCase())) {
        requiresEnrollment = requiresEnrollment || resolveEnrollment(rawValue);
      }
    }

    if (label) addPerk(label);
    if (description) addPerk(description);

    const text = `${label ?? ""} ${description ?? ""}`.trim();
    if (!amountValue && text) {
      amountValue = parseAmountFromText(text);
    }

    if (amountValue && (label || description)) {
      const period = periodValue ?? normalizePeriod(text, amountKeyHint);
      if (creditKeywords.test(text) || /credit/i.test(label ?? "") || /credit/i.test(description ?? "")) {
        merchant = merchant || extractMerchantFromText(text);
        if (merchant) {
          const labelText =
            label && /credit/i.test(label)
              ? label
              : `$${amountValue} statement credit at ${merchant}`;
          addMerchantCredit({
            label: labelText,
            amountUSD: amountValue,
            period,
            merchant,
            requiresEnrollment,
          });
        } else {
          const labelText = label ?? description ?? `$${amountValue} credit`;
          addRecurringCredit({
            label: labelText,
            amountUSD: amountValue,
            period,
            requiresEnrollment,
          });
        }
      }
    }

    for (const value of Object.values(entry)) walk(value);
  }

  for (const blob of blobs) walk(blob);

  return {
    perks: perks.slice(0, 40),
    merchantCredits,
    recurringCredits,
    sourceUrl: url,
    confidence: 0.6,
  };
}
