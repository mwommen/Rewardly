// backend/scrapers/adapters/discover.ts
import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";

const HINT_SELECTORS = [
  "main", "body", "[role=main]", ".content", ".page", "#content",
  "h1", "h1 span", "[data-testid*=title]"
];

async function readText(page: Page): Promise<string> {
  for (const s of HINT_SELECTORS) {
    try {
      await page.waitForSelector(s, { timeout: 3500 });
      const t = await page.locator(s).innerText().catch(() => "");
      if (t && t.trim().length > 40) return t;
    } catch {}
  }
  return page.locator("body").innerText().catch(() => "");
}

function nameFrom(text: string): string {
  const m = text.match(/\b(discover)\s+([a-z][a-z\s]+?)\b(card)?/i);
  if (m) return `Discover ${m[2].trim().replace(/\bcard$/i, "")}`;
  if (/cash back/i.test(text)) return "Discover Cash Back";
  if (/it\b/i.test(text)) return "Discover it";
  return "Discover Card";
}

function feeFrom(text: string): number | null {
  if (/\bno annual fee\b/i.test(text)) return 0;
  const m = text.match(/\$\s*([0-9]{1,3})(?:\.[0-9]{2})?\s*(annual\s*fee)?/i);
  return m ? parseInt(m[1], 10) : 0; // Discover consumer cards are typically no AF
}

function rewardsFrom(text: string) {
  // Discover 5% rotating + 1% base
  const out: Record<string, number> = {};
  // baseline
  if (/1\s*%/.test(text) || /1\s*x/i.test(text)) out.other = 0.01;

  // We won’t guess the quarter here; rotating is modeled separately
  return out;
}

type RotatingQuarter = {
  start?: string;
  end?: string;
  activationRequired?: boolean;
  categories?: { keys?: string[]; rate: number | string; unit?: "cash" | "points" }[];
};

function rotatingFrom(text: string): RotatingQuarter[] {
  // Just capture the fact it’s 5% rotating categories with activation + cap
  const quarters: RotatingQuarter[] = [];

  const hasRotating = /(5\s*%|5\s*x).{0,30}(rotating|categories)/i.test(text);
  if (hasRotating) {
    quarters.push({
      activationRequired: /activation required/i.test(text) || true,
      categories: [
        { keys: ["rotating"], rate: "5%", unit: "cash" },
      ],
    });
  }
  return quarters;
}

function perksFrom(text: string): string[] {
  const out: string[] = [];
  if (/cashback match/i.test(text)) out.push("Unlimited Cashback Match first year");
  if (/\bno annual fee\b/i.test(text)) out.push("No annual fee");
  if (/price protection|extended warranty|purchase protection/i.test(text)) {
    const m = text.match(/(price protection|extended warranty|purchase protection)/gi);
    if (m) out.push(...m);
  }
  // normalize
  const seen = new Set<string>();
  return out
    .map(s => s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim())
    .filter(s => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return s.length > 5 && s.length < 140;
    })
    .slice(0, 10);
}

function signupFrom(text: string): string | null {
  const m = text.match(/cashback match[^.\n]*first year/i);
  return m ? m[0].replace(/[™®©]/g, "").trim() : null;
}

export const discoverAdapter: ScrapeAdapter = {
  id: "discover",
  matches: (url) => /(^|\.)discover\.com\/credit-cards\//i.test(url),

  async run(page: Page, url: string) {
    await Promise.race([
      page.waitForLoadState("domcontentloaded", { timeout: 10_000 }),
      page.waitForLoadState("networkidle", { timeout: 10_000 }),
    ]).catch(() => {});
    await page.waitForTimeout(800).catch(() => {});

    const text = await readText(page);
    if (!text) throw new Error("Unable to read page text");

    const name = nameFrom(text);
    const annualFee = feeFrom(text);
    const rewardsByCategory = rewardsFrom(text);
    const rewardsRotating = rotatingFrom(text);
    const perks = perksFrom(text);
    const signupOffer = signupFrom(text);

    return {
      issuer: "Discover",
      name,
      annualFee,
      rewardsByCategory,
      rewardsRotating,
      perks,
      signupOffer,
      sourceUrl: url,
      confidence: 0.75,
    };
  },
};
