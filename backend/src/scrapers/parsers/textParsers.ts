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

export function extractPerksFromText(text: string, max = 12): string[] {
  const lines = text.split(/[\.\n]|•|-/).map(s => s.trim());
  const perks: string[] = [];
  for (const line of lines) {
    if (
      /points|miles|cash back|benefit|reward|credit|travel|dining|airport|lounge|warranty|protection/i.test(line) &&
      line.length > 25 &&
      !/^©/.test(line)
    ) {
      perks.push(line);
      if (perks.length >= max) break;
    }
  }
  return perks;
}
