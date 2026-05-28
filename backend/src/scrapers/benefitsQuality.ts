const JUNK_BENEFIT_PATTERN =
  /(data-react-helmet|react-helmet|window\.__|__initial_state__|axp-footer|creditcards_logo_text|free-credit-score|freecreditscore|hamnav|credit journey|jpmc|marketplace|<meta|<link|<script|<img|<a\s|stylesheet|@charset|slick-slider|\.icon-[a-z0-9-]+:before|\\e[0-9a-f]{3,4}|\\u00[0-9a-f]{2}|\\u0026|\\\"|\[\s*\"|\"\s*,\s*\"|\.svg\b|function\(|document\.)/i;

type CreditLike = {
  label?: string;
  name?: string;
  amountUSD?: number;
  period?: string;
};

function normalizeStoredPerk(line: string) {
  return String(line || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/([a-z])(?:SM|TM|RM)\b/g, "$1")
    .replace(/\b(SM|TM|RM)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLikelyJunkBenefitText(value: string): boolean {
  return JUNK_BENEFIT_PATTERN.test(String(value || ""));
}

export function cleanPerksForStorage(perks: string[] | undefined): string[] {
  if (!Array.isArray(perks)) return [];
  const seen = new Set<string>();
  return perks
    .filter((line) => !isLikelyJunkBenefitText(String(line || "")))
    .map((line) => normalizeStoredPerk(line))
    .map((line) => (line.length > 220 ? `${line.slice(0, 217).trim()}...` : line))
    .filter((line) => line.length >= 8)
    .filter(
      (line) =>
        !/(data-react-helmet|react-helmet|window\.__|__initial_state__|_formControl_|_search_|<meta|<link|<script|<img|<a\s|stylesheet|css\-|privacy|terms of service|site map|adchoices|axp-footer|favicon|canonical|viewport|content=|cookie|function\(|document\.|creditcards_logo_text|free-credit-score|freecreditscore|hamnav|credit journey|jpmc|marketplace|\.svg\b)/i.test(
          line
        )
    )
    .filter((line) => {
      const key = line
        .toLowerCase()
        .replace(/[®™]/g, "")
        .replace(/([a-z])(?:sm|tm|rm)\b/g, "$1")
        .replace(/\b(sm|tm|rm)\b/g, "")
        .replace(/\$\d+(?:\.\d+)?/g, "$")
        .replace(/[^a-z0-9$]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeStoredCreditLabel(value: string) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/([a-z])(?:SM|TM|RM)\b/g, "$1")
    .replace(/\b(SM|TM|RM)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCreditKey(credit: CreditLike) {
  const label = normalizeStoredCreditLabel(String(credit.label || credit.name || ""))
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/([a-z])(?:sm|tm|rm)\b/g, "$1")
    .replace(/\b(sm|tm|rm)\b/g, "")
    .replace(/\$\d+(?:\.\d+)?/g, "$")
    .replace(/[^a-z0-9$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const amount = Number.isFinite(credit.amountUSD) ? Number(credit.amountUSD) : 0;
  const period = String(credit.period || "").trim().toLowerCase();
  return `${label}|${amount}|${period}`;
}

export function cleanCreditsForStorage<T extends CreditLike>(credits: T[] | undefined): T[] {
  if (!Array.isArray(credits)) return [];
  const seen = new Set<string>();
  const out: T[] = [];

  for (const credit of credits) {
    const label = normalizeStoredCreditLabel(String(credit.label || credit.name || ""));
    if (!label) continue;
    if (isLikelyJunkBenefitText(label)) continue;

    const next = {
      ...credit,
      ...(credit.label !== undefined ? { label } : {}),
      ...(credit.name !== undefined && credit.label === undefined ? { name: label } : {}),
    } as T;

    const key = getCreditKey(next);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }

  return out;
}

export function evaluateBenefitsQuality(input: {
  perks?: string[];
  merchantCredits?: Array<{ label?: string }>;
  recurringCredits?: Array<{ label?: string }>;
}) {
  const lines: string[] = [
    ...(input.perks || []),
    ...((input.merchantCredits || []).map((c) => String(c.label || ""))),
    ...((input.recurringCredits || []).map((c) => String(c.label || ""))),
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  const junkLines = lines.filter((v) => isLikelyJunkBenefitText(v));
  const total = lines.length;
  const junkCount = junkLines.length;
  const junkRatio = total ? junkCount / total : 0;
  const needsReview = junkCount >= 2 || junkRatio >= 0.25;

  return {
    needsReview,
    total,
    junkCount,
    junkRatio,
    sample: junkLines.slice(0, 3),
    checkedAt: new Date().toISOString(),
  };
}
