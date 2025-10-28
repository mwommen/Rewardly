// backend/scrapers/adapters/citi.ts
import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";

const SELS = [
  "main", "body", "[role=main]", ".page", ".content", "#content",
  "h1", "h1 span", "h1[data-testid]", "[data-testid*=title]"
];

const NAME_HINTS = [
  /citi\s+(custom cash|double cash|premier|rewards\+|simplicity)/i,
  /(custom cash|double cash|premier|rewards\+|simplicity)/i,
  /citi\s+(\w[\w\s+]+?)(?:\s+card|$)/i
];

function first<T>(...vals: Array<T | null | undefined>) {
  for (const v of vals) if (v != null) return v as T;
  return undefined as any;
}

async function getText(page: Page): Promise<string> {
  for (const s of SELS) {
    try {
      await page.waitForSelector(s, { timeout: 4000 });
      const t = await page.locator(s).innerText().catch(() => "");
      if (t && t.trim().length > 40) return t;
    } catch {}
  }
  // fallback
  return page.locator("body").innerText().catch(() => "");
}

function extractName(text: string): string | undefined {
  for (const rx of NAME_HINTS) {
    const m = text.match(rx);
    if (m) {
      const core = (m[1] || m[0]).replace(/card$/i, "").trim();
      return /citi/i.test(core) ? core : `Citi ${core}`;
    }
  }
  // Generic fallback
  const h1 = text.split("\n").find(l => /^citi\b/i.test(l.trim()));
  return h1 ? h1.trim() : undefined;
}

function extractAnnualFee(text: string): number | null {
  // $95, $0 intro then $95, No Annual Fee
  const no = /(^|\b)no annual fee\b/i.test(text);
  if (no) return 0;
  const m = text.match(/\$\s*([0-9]{1,3})(?:\.[0-9]{2})?\s*(annual\s*fee)?/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseRate(s: string): number {
  // "5%", "3 x", "3x", "3X"
  const pct = s.match(/(\d+(\.\d+)?)\s*%/);
  if (pct) return Math.max(0, parseFloat(pct[1]) / 100);
  const mult = s.match(/(\d+(\.\d+)?)\s*x\b/i);
  if (mult) return Math.max(0, parseFloat(mult[1])); // multiplier (points)
  return 0;
}

function extractRewards(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const lower = text.toLowerCase();

  // Heuristics
  // Dining / Restaurants
  if (/(dining|restaurants?|eating out|coffee)/i.test(text)) {
    const m = text.match(/(\d+(\.\d+)?)\s*(%|x).{0,24}(dining|restaurants?)/i);
    if (m) out["dining"] = parseRate(m[0]);
  }
  // Groceries
  if (/grocer|supermarket/i.test(text)) {
    const m = text.match(/(\d+(\.\d+)?)\s*(%|x).{0,24}(grocer|supermarket)/i);
    if (m) out["groceries"] = parseRate(m[0]);
  }
  // Gas
  if (/\bgas|fuel\b/i.test(lower)) {
    const m = text.match(/(\d+(\.\d+)?)\s*(%|x).{0,24}(gas|fuel)/i);
    if (m) out["gas"] = parseRate(m[0]);
  }
  // Transit
  if (/transit|subway|train|bus/i.test(text)) {
    const m = text.match(/(\d+(\.\d+)?)\s*(%|x).{0,24}(transit|subway|train|bus)/i);
    if (m) out["transit"] = parseRate(m[0]);
  }
  // Drugstores
  if (/drugstore|pharmacy/i.test(text)) {
    const m = text.match(/(\d+(\.\d+)?)\s*(%|x).{0,24}(drugstore|pharmacy)/i);
    if (m) out["drugstores"] = parseRate(m[0]);
  }
  // Online
  if (/online|e-?commerce/i.test(text)) {
    const m = text.match(/(\d+(\.\d+)?)\s*(%|x).{0,24}(online|e-?commerce)/i);
    if (m) out["online"] = parseRate(m[0]);
  }

  // Baseline (catch-all)
  if (!("other" in out)) {
    // look for lone "1%" or "1x everywhere"
    const base = text.match(/\b(1(\.0+)?)\s*(%|x)\s+(everywhere|all|base|other|purchases)/i);
    if (base) out["other"] = parseRate(base[0]);
  }

  return out;
}

function extractPerks(text: string): string[] {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const keepers: string[] = [];
  for (const l of lines) {
    if (/no annual fee/i.test(l)) keepers.push("No annual fee");
    if (/0% intro/i.test(l)) keepers.push(l);
    if (/global entry|tsa precheck/i.test(l)) keepers.push(l);
    if (/purchase protection|extended warranty|travel insurance|cell phone protection/i.test(l)) keepers.push(l);
    if (/points transfer|transfer partners/i.test(l)) keepers.push(l);
  }
  // dedupe + shorten
  const seen = new Set<string>();
  return keepers
    .map(s => s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim())
    .filter(s => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return s.length > 6 && s.length < 180;
    })
    .slice(0, 10);
}

function extractSignup(text: string): string | null {
  // “Earn 60,000 ThankYou® Points after you spend $4,000…”
  const m = text.match(/earn\s+[\d,]+\s+.*?(points|miles|cash)[^.\n]*after[^.\n]*/i);
  return m ? m[0].replace(/[™®©]/g, "").trim() : null;
}

export const citiAdapter: ScrapeAdapter = {
  id: "citi",
  matches: (url) => /(^|\.)citi\.com\//i.test(url),

  async run(page: Page, url: string) {
    // Wait strategy: race a couple of candidates + give up at 20s
    await Promise.race([
      page.waitForLoadState("domcontentloaded", { timeout: 10_000 }),
      page.waitForLoadState("networkidle", { timeout: 10_000 }),
    ]).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const text = await getText(page);
    if (!text) throw new Error("Unable to read page text");

    const name = first(extractName(text), "Citi Card");
    const annualFee = extractAnnualFee(text);
    const rewardsByCategory = extractRewards(text);
    const perks = extractPerks(text);
    const signupOffer = extractSignup(text);

    return {
      issuer: "Citi",
      name,
      annualFee,
      rewardsByCategory,
      perks,
      signupOffer,
      sourceUrl: url,
      confidence: 0.7,
    };
  },
};
