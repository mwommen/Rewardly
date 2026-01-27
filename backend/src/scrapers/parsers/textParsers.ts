// backend/scrapers/parsers/textParsers.ts
export function normalizeCategory(raw: string) {
  const s = raw.toLowerCase();
  if (s.includes("grocery") || s.includes("supermarket")) return "groceries";
  if (s.includes("apparel") || s.includes("clothes") || s.includes("fashion")) return "apparel";
  if (s.includes("online")) return "online_shopping";
  if (s.includes("travel") || s.includes("airfare") || s.includes("airlines")) return "travel";
  if (s.includes("dining") || s.includes("restaurant")) return "dining";
  if (s.includes("gas")) return "gas";
  if (s.includes("drugstore")) return "drugstore";
  return null;
}

export function extractAnnualFeeFromText(text: string): number | null {
  const feeMatch = text.match(/Annual Fee[^$]*(\$?\s*\d{1,4})/i);
  if (!feeMatch) return null;
  const n = Number(feeMatch[1].replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function extractRewardsFromText(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /(\d+(?:\.\d+)?)\s*[xX]\s*(?:points|miles|cash back)?\s*(?:on|at|for)\s+([a-zA-Z\s]+)/g;
  for (const m of text.matchAll(re)) {
    const val = Number(m[1]);
    const cat = normalizeCategory(m[2] || "");
    if (cat && Number.isFinite(val)) out[cat] = Math.max(out[cat] || 0, val);
  }
  return out;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&reg;|&trade;|&copy;/gi, "");
}

export function sanitizeTextForParsing(text: string): string {
  const withoutTags = text.replace(/<[^>]+>/g, "\n");
  return decodeHtmlEntities(withoutTags).replace(/[ \t]+/g, " ");
}

function cleanPerkLine(line: string, maxLen = 200): string | null {
  const cleaned = decodeHtmlEntities(line).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLen) return null;
  return cleaned;
}

export function extractPerksFromText(text: string, max = 12): string[] {
  const safeText = sanitizeTextForParsing(text);
  const lines = safeText.split(/[\.\n]|•|-/).map(s => s.trim());
  const perks: string[] = [];
  for (const line of lines) {
    const cleaned = cleanPerkLine(line);
    if (!cleaned) continue;
    if (
      /points|miles|cash back|benefit|reward|credit|travel|dining|airport|lounge|warranty|protection/i.test(cleaned) &&
      cleaned.length > 25 &&
      !/^©/.test(cleaned)
    ) {
      perks.push(cleaned);
      if (perks.length >= max) break;
    }
  }
  return perks;
}
