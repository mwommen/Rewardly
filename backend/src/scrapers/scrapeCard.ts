// backend/scrapers/scrapeCard.ts
import { chromium, Browser } from "playwright";
// Prefer using getDb so we don't fight path helpers
import { getDb } from "../db";
import { getAdapterForUrl } from "./adapters";
import type { PartialCard } from "./adapters/base";
import type { Collection, UpdateFilter } from "mongodb";

/** ---- Local minimal types to avoid new imports turning your tree red ---- */
type Period = "month" | "quarter" | "semi-annual" | "year";
type RewardsArrayEntry = { keys: string[]; rate: string; unit: "cash" | "points" | "miles" };
type RotatingWindow = {
  start?: string; end?: string; activationRequired?: boolean;
  categories: { keys: string[]; rate: string; unit: "cash" | "points" | "miles" }[];
};
type MerchantCredit = {
  id: string; label: string; amountUSD: number; period: Period; capPerPeriodUSD: number;
  eligibleWhen?: { merchantPatterns?: string[]; mcc?: string[] };
  requiresEnrollment?: boolean; expiresAt?: string | null; sourceUrl?: string; confidence?: number;
};
type RecurringCredit = {
  id: string; label: string; amountUSD: number; period: Period;
  partner?: string; requiresEnrollment?: boolean; sourceUrl?: string; confidence?: number;
};
type BenefitsPayload = {
  rewardsByCategory?: RewardsArrayEntry | RewardsArrayEntry[] | Record<string, string>;
  rewardsFlat?: { rate: number; unit: "cash" | "points" | "miles" }[];
  rewardsRotating?: RotatingWindow[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  perks?: string[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  signupOffer?: string | null;
  sourceUrl?: string;
  lastScraped?: string;
  confidence?: number;
};
/** ----------------------------------------------------------------------- */

type ScrapeResult = PartialCard & {
  slug: string;
  lastScraped: string;
  name: string;
  issuer: string | null;
  annualFee: number | null;
  rewardsByCategory: Record<string, number>;
  perks: string[];
  signupOffer: string | null;
  sourceUrl: string;
  confidence: number;

  // New enrichment fields (optional per card)
  rewardsRotating?: RotatingWindow[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string }[];
};

// What we persist in Mongo
type StoredCard = {
  slug: string;
  name?: string;
  issuer?: string | null;
  annualFee?: number | null;
  rewardsByCategory?: Record<string, number>;
  rewardsRotating?: RotatingWindow[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  perks?: string[];
  signupOffer?: string | null;
  sourceUrl?: string;
  confidence?: number;
  lastScraped?: string;
};

function guessIssuerFromUrl(url: string) {
  const u = url.toLowerCase();
  if (u.includes("americanexpress")) return "American Express";
  if (u.includes("chase")) return "Chase";
  if (u.includes("citi")) return "Citi";
  if (u.includes("discover")) return "Discover";
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t!));
}

/** Try to enrich adapter output with issuer-aware parser (if present). */
async function applyBenefitsEnrichment(
  pageText: string,
  url: string
): Promise<BenefitsPayload | null> {
  try {
    // Dynamic import so your file doesn't go red if parsers aren't created yet.
    // @ts-ignore - allow resolving at runtime when you add the file.
    const mod = await import("./parsers");
    const pickParser: ((u: string) => (t: string, u?: string) => BenefitsPayload) | undefined =
      mod?.pickParser;
    if (!pickParser) return null;

    const parse = pickParser(url);
    const benefits: BenefitsPayload = parse(pageText, url);
    return benefits || null;
  } catch (e) {
    // Safe fallback if the registry isn't there yet.
    console.warn("ℹ️ Parser registry not available yet, skipping enrichment.");
    return null;
  }
}

export async function scrapeCardUrl(url: string, slug: string): Promise<ScrapeResult | null> {
  let browser: Browser | null = null;

  try {
    const headless = (process.env.SCRAPER_HEADLESS || "true").toLowerCase() !== "false";

    browser = await chromium.launch({
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--disable-extensions",
        "--window-size=1400,900",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
      viewport: { width: 1360, height: 820 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    await context.addInitScript(`
      try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch(e){}
      try { Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] }); } catch(e){}
      try { Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] }); } catch(e){}
      try { if (!window.chrome) window.chrome = { runtime: {} }; } catch(e){}
    `);

    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Upgrade-Insecure-Requests": "1",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });

    console.log(`🌐 Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    } catch (e) {
      console.warn("⚠️ goto() warning (continuing):", (e as Error).message);
    }

    // small idle + scroll to hydrate
    await page.waitForTimeout(1200).catch(() => {});
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(700);
    }

    const adapter = getAdapterForUrl(url);
    if (!adapter) throw new Error(`No adapter available for ${url}`);
    console.log(`🔍 Using adapter: ${adapter.id}`);

    const partial = await withTimeout(adapter.run(page, url), 90_000, `adapter ${adapter.id}`);

    // Get visible text once for parser enrichment
    const pageText: string = await page.evaluate(() => document.body.innerText || "");

    // Try to parse full benefits (YAML/issuer-aware)
    const enrichment = await applyBenefitsEnrichment(pageText, url);

    // Build a fully shaped result with reliable defaults
    const result: ScrapeResult = {
      slug,
      name: partial.name || slug,
      issuer: partial.issuer ?? guessIssuerFromUrl(url),
      annualFee: typeof partial.annualFee === "number" ? partial.annualFee : null,
      rewardsByCategory: partial.rewardsByCategory || {},
      perks: partial.perks || [],
      signupOffer: partial.signupOffer ?? enrichment?.signupOffer ?? null,
      sourceUrl: partial.sourceUrl || enrichment?.sourceUrl || url,
      confidence:
        typeof partial.confidence === "number"
          ? partial.confidence
          : typeof enrichment?.confidence === "number"
          ? enrichment.confidence!
          : 0.6,
      lastScraped: new Date().toISOString(),
      // Enrichment fields (optional)
      rewardsRotating: enrichment?.rewardsRotating,
      merchantCredits: enrichment?.merchantCredits,
      recurringCredits: enrichment?.recurringCredits,
      access: enrichment?.access,
      insurances: enrichment?.insurances,
    };

    console.log("✅ Extracted (adapter + enrichment)", {
      name: result.name,
      annualFee: result.annualFee,
      rewardsByCategory: result.rewardsByCategory,
      merchantCredits: result.merchantCredits?.length || 0,
      recurringCredits: result.recurringCredits?.length || 0,
      perksSample: (result.perks || []).slice(0, 3),
      confidence: result.confidence,
    });

    return result;
  } catch (err) {
    console.error("❌ Scrape error for", url, err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

/** Optional bulk orchestrator stub to satisfy routes that call runScrapers(). */
export async function runScrapers(issuers?: string[]) {
  return (issuers || []).map((issuer) => ({ issuer, count: 0, confidence: 0 }));
}

// --------------------
// CLI runner (manual):
// ts-node backend/scrapers/scrapeCard.ts <url> <slug>
// --------------------
if (require.main === module) {
  (async () => {
    const url = process.argv[2];
    const slug = process.argv[3] || "unknown-card";
    if (!url) {
      console.error("Usage: ts-node backend/scrapers/scrapeCard.ts <url> <slug>");
      process.exit(1);
    }

    const res = await scrapeCardUrl(url, slug);
    if (!res) process.exit(2);

    const db = await getDb();
    const col: Collection<StoredCard> = db.collection<StoredCard>("cards");

    const existing = await col.findOne({ slug });

    const merged: StoredCard = {
      ...(existing || {}),
      ...(res || {}),
      // Prefer newly scraped structured bits, otherwise keep existing
      rewardsByCategory:
        res?.rewardsByCategory && Object.keys(res.rewardsByCategory).length
          ? res.rewardsByCategory
          : existing?.rewardsByCategory || {},
      rewardsRotating:
        (res as any).rewardsRotating?.length ? (res as any).rewardsRotating : existing?.rewardsRotating || [],
      merchantCredits:
        (res as any).merchantCredits?.length ? (res as any).merchantCredits : existing?.merchantCredits || [],
      recurringCredits:
        (res as any).recurringCredits?.length ? (res as any).recurringCredits : existing?.recurringCredits || [],
      perks: res?.perks && res.perks.length ? res.perks : existing?.perks || [],
      signupOffer: res?.signupOffer ?? existing?.signupOffer ?? null,
      issuer: res?.issuer ?? existing?.issuer ?? null,
      lastScraped: res?.lastScraped ?? existing?.lastScraped ?? new Date().toISOString(),
      confidence:
        typeof res?.confidence === "number"
          ? res.confidence
          : typeof existing?.confidence === "number"
          ? existing.confidence
          : 0,
      sourceUrl: res?.sourceUrl ?? existing?.sourceUrl ?? url,
      slug,
    };

    await col.updateOne(
      { slug },
      { $set: merged } as UpdateFilter<StoredCard>,
      { upsert: true }
    );

    const stored = await col.findOne({ slug });
    console.log("✅ Upserted:", stored?.slug || slug);
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
