// backend/scrapers/adapters/citi.ts
import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";

const SELS = [
  "main",
  "[role=main]",
  ".page",
  ".content",
  "#content",
  "body",
  "h1",
  "h1 span",
  "h1[data-testid]",
  "[data-testid*=title]",
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

function annualFeeOverrideFromUrl(url: string): number | null {
  const u = url.toLowerCase();
  if (u.includes("custom-cash")) return 0;
  if (u.includes("double-cash")) return 0;
  if (u.includes("rewards-plus")) return 0;
  if (u.includes("simplicity")) return 0;
  if (u.includes("premier")) return 95;
  return null;
}

function parseRate(num: string, unit: string): number | null {
  const n = Number.parseFloat(num);
  if (!Number.isFinite(n)) return null;
  if (unit === "%") return n / 100;
  return n;
}

function categoriesFromText(raw: string): string[] {
  const s = (raw || "").toLowerCase();
  const out: string[] = [];
  if (s.includes("dining") || s.includes("restaurant") || s.includes("eating out")) out.push("dining");
  if (s.includes("grocery") || s.includes("supermarket")) out.push("groceries");
  if (s.includes("gas") || s.includes("fuel")) out.push("gas");
  if (s.includes("transit") || s.includes("subway") || s.includes("train") || s.includes("bus")) out.push("transit");
  if (s.includes("drugstore") || s.includes("pharmacy")) out.push("drugstores");
  if (s.includes("online") || s.includes("e-commerce")) out.push("online_shopping");
  if (s.includes("all other") || s.includes("other purchases") || s.includes("everywhere")) out.push("other");
  return Array.from(new Set(out));
}

function extractRewards(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const rewardRegex =
    /(\d+(?:\.\d+)?)\s*(x|%)(?:\s*(?:points|miles|cash back|back))?[^.\n]{0,140}/gi;

  for (const match of text.matchAll(rewardRegex)) {
    const [snippet, num, unit] = match;
    if (/bonus|welcome|intro/i.test(snippet)) continue;
    const rate = parseRate(num, unit);
    if (rate == null) continue;
    const cats = categoriesFromText(snippet);
    if (!cats.length) continue;
    for (const cat of cats) {
      out[cat] = Math.max(out[cat] || 0, rate);
    }
  }
  return out;
}

function cleanPerks(lines: string[], cardName?: string): string[] {
  const keepers: string[] = [];
  const seen = new Set<string>();
  const normalizedCardName = (cardName || "").toLowerCase();

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || line.length < 12 || line.length > 180) continue;
    if (normalizedCardName && line.toLowerCase().includes(normalizedCardName)) continue;
    if (/selector_\d+|window\.|utm_|tnt_|privacy|cookie|consent|javascript|@charset|<script|<\/script/i.test(line)) {
      continue;
    }
    if (/earn\s+[\d,]+\s+.*?bonus\s+points/i.test(line)) continue;
    if (/reward(s)? program|credit cards? offers|opens new credit card offers/i.test(line)) continue;
    if (/no annual fee/i.test(line)) keepers.push("No annual fee");
    if (/0% intro/i.test(line)) keepers.push(line);
    if (/global entry|tsa precheck/i.test(line)) keepers.push(line);
    if (/purchase protection|extended warranty|travel insurance|cell phone protection/i.test(line)) keepers.push(line);
    if (/points transfer|transfer partners/i.test(line)) keepers.push(line);
  }

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
    const annualFee = annualFeeOverrideFromUrl(url) ?? extractAnnualFee(text);
    const rewardsByCategory = extractRewards(text);
    const perks = cleanPerks(text.split("\n").map((l) => l.trim()), name);
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
