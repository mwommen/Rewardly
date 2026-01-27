// backend/src/scrapers/scrapeCard.ts
import { chromium, Browser } from "playwright";
import { getDb } from "../db";
import { getAdapterForUrl } from "./adapters";
import type { PartialCard } from "./adapters/base";
import type { Collection, UpdateFilter } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import fetch from "node-fetch";
import crypto from "node:crypto";
import { pickParser } from "./parsers";
import { CARD_OVERRIDES } from "./overrides/cards";
import type {
  BenefitsPayload,
  MerchantCredit,
  RecurringCredit,
  RotatingWindow,
} from "../models/benefits";

type ScrapeResult = PartialCard & {
  slug: string;
  lastScraped: string;
  name: string;
  issuer: string | null;
  annualFee: number | null;
  apr: string | null;
  rewardsByCategory: Record<string, number>;
  perks: string[];
  signupOffer: string | null;
  sourceUrl: string;
  confidence: number;
  benefitsDetail?: BenefitsPayload;
  rewardsRotating?: RotatingWindow[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string }[];
};

type StoredCard = {
  slug: string;
  name?: string;
  issuer?: string | null;
  annualFee?: number | null;
  apr?: string | null;
  rewardsByCategory?: Record<string, number>;
  benefitsDetail?: BenefitsPayload;
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

type BenefitsHistoryEntry = {
  slug: string;
  scrapedAt: string;
  sourceUrl?: string;
  benefits: BenefitsPayload;
  hash: string;
};

function sanitizeCredits<T extends { label: string; amountUSD: number; period: string; confidence?: number }>(
  credits: T[] | undefined
): T[] {
  if (!credits?.length) return [];
  const seen = new Set<string>();
  const normalizedSeen = new Set<string>();
  return credits.filter((credit) => {
    const cleaned = (credit.label || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    let label = cleaned;
    if (/anniversary bonus|bonus miles|bonus points/i.test(label)) {
      label = label
        .replace(/\b\d{1,3}(?:,\d{3})?\s*(miles?|points?)\b/gi, "")
        .replace(/anniversary bonus|bonus miles|bonus points/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (label !== credit.label) {
      (credit as any).label = label;
    }
    if (!label || label.length > 160) return false;
    if (/[<>]/.test(label) || /https?:\/\//i.test(label)) return false;
    if (
      /(credit\s*cards?|creditcards|\/credit-cards|icell=|jp_ltg=|utm_|hamnav|footer|header|nav)/i.test(label)
    ) {
      return false;
    }
    if (/without notice|any time/i.test(label)) return false;
    if (/\$\{[^}]+\}/.test(label)) return false;
    if (/\.svg\b/i.test(label) || /\blogo\b/i.test(label)) return false;
    if (/^showcase[-_]/i.test(label)) return false;
    if (/\b(www\.|\.com|\.net|\.org)\b/i.test(label)) return false;
    if (
      !/(credit|statement|cash|reimburse|membership|hotel|travel|airline|uber|saks|resy|walmart|lululemon|clear|digital)/i.test(
        label
      )
    ) {
      return false;
    }
    if (!Number.isFinite(credit.amountUSD) || credit.amountUSD < 5 || credit.amountUSD > 1000) {
      return false;
    }
    if (credit.confidence != null && credit.confidence < 0.7) return false;
    const key = `${label}|${credit.amountUSD}|${credit.period}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const normalizedLabel = label
      .toLowerCase()
      .replace(/\$\s*/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalizedLabel) {
      const normalizedKey = `${credit.amountUSD}|${credit.period}|${normalizedLabel}`;
      if (normalizedSeen.has(normalizedKey)) return false;
      normalizedSeen.add(normalizedKey);
    }
    return true;
  });
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableSort(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

function hashBenefits(benefits: BenefitsPayload): string {
  const normalized = stableSort(benefits);
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

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

/** Load fallback URLs (issuer_patterns.amex.fallbackUrls) from YAML, if present. */
function loadAmexFallbackUrls(): string[] {
  try {
    const candidatePaths = [
      path.join(__dirname, "..", "rules", "benefit_patterns.yaml"),
      path.join(process.cwd(), "src", "scrapers", "rules", "benefit_patterns.yaml"),
      path.join(process.cwd(), "backend", "src", "scrapers", "rules", "benefit_patterns.yaml"),
    ];

    const rulesPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!rulesPath) return [];

    const raw = fs.readFileSync(rulesPath, "utf8");
    const doc = yaml.load(raw) as any;
    return doc?.issuer_patterns?.amex?.fallbackUrls || [];
  } catch {
    return [];
  }
}

/** Try to enrich adapter output with issuer-aware parser (if present). */
async function applyBenefitsEnrichment(
  pageText: string,
  url: string
): Promise<BenefitsPayload | null> {
  try {
    const parse = pickParser(url);
    const benefits: BenefitsPayload = parse(pageText, url);
    return benefits || null;
  } catch {
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
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });

    // Capture HTML/JSON responses
    const responseBodies: string[] = [];
    page.on("response", async (resp) => {
      try {
        const ct = resp.headers()["content-type"] || "";
        if (!/json|html|text/i.test(ct)) return;
        const u = resp.url();
        if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)(\?|$)/i.test(u)) return;
        const body = await resp.text();
        if (body && body.length >= 40) responseBodies.push(body);
      } catch {}
    });

    const waitUntil = (process.env.SCRAPER_WAIT_UNTIL || "domcontentloaded") as
      | "domcontentloaded"
      | "load"
      | "networkidle";
    const navTimeout = Number(process.env.SCRAPER_NAV_TIMEOUT_MS || 45_000);

    console.log(`🌐 Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil, timeout: navTimeout });
    } catch (e) {
      console.warn("⚠️ goto() warning (continuing):", (e as Error).message);
    }

    // Hydrate
    await page.waitForTimeout(1200).catch(() => {});
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(700);
    }

    const adapter = getAdapterForUrl(url);
    if (!adapter) throw new Error(`No adapter available for ${url}`);
    console.log(`🔍 Using adapter: ${adapter.id}`);

    const partial = await withTimeout(adapter.run(page, url), 90_000, `adapter ${adapter.id}`);

    // Expanders & cookies (light-touch)
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(600);

    const consentSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Agree")',
      'button:has-text("I Accept")',
      'button[aria-label*="Accept"]',
    ];
    for (const sel of consentSelectors) {
      const el = await page.$(sel);
      if (el) { await el.click().catch(() => {}); await page.waitForTimeout(250); }
    }

    const expanders = await page.$$("button, a");
    for (const el of expanders) {
      const txt = (await el.innerText().catch(() => ""))?.toLowerCase() || "";
      if (/(learn more|view details|see details|terms apply|expand|show more)/.test(txt)) {
        await el.click().catch(() => {});
        await page.waitForTimeout(80);
      }
    }

    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(150);
    }

    const pageText: string = await page.evaluate(() => document.body.innerText || "");
    const html = await page.content();

    // 🔽 NEW: fetch fallback URLs from YAML and append their bodies
    let fallbackConcat = "";
    const fallbacks = loadAmexFallbackUrls();
    for (const fUrl of fallbacks) {
      try {
        const res = await fetch(fUrl);
        if (!res.ok) continue;
        const body = await res.text();
        fallbackConcat += `\n\n<!-- Fallback: ${fUrl} -->\n` + body;
      } catch {}
    }

    const networkConcat = responseBodies.join("\n\n");
    console.log("🪵 DEBUG lengths:", {
      pageTextLen: pageText.length,
      htmlLen: html.length,
      networkLen: networkConcat.length,
      fallbackLen: fallbackConcat.length,
      responses: responseBodies.length,
      fallbacks: fallbacks.length,
    });

    const searchable = `${pageText}\n${html}\n${networkConcat}\n${fallbackConcat}`;

    // YAML/issuer-aware enrichment
    const enrichment = await applyBenefitsEnrichment(searchable, url);
    const benefitsDetail = enrichment
      ? { ...enrichment, lastScraped: new Date().toISOString() }
      : undefined;

    const result: ScrapeResult = {
      slug,
      name: partial.name || slug,
      issuer: partial.issuer ?? guessIssuerFromUrl(url),
      annualFee: typeof partial.annualFee === "number" ? partial.annualFee : null,
      apr: partial.apr ?? null,
      rewardsByCategory: partial.rewardsByCategory || {},
      perks: Array.from(
        new Set([...(partial.perks || []), ...(enrichment?.perks || [])].map((p) => String(p || "").trim()).filter(Boolean))
      ),
      signupOffer: partial.signupOffer ?? enrichment?.signupOffer ?? null,
      sourceUrl: partial.sourceUrl || enrichment?.sourceUrl || url,
      confidence:
        typeof partial.confidence === "number"
          ? partial.confidence
          : typeof enrichment?.confidence === "number"
          ? enrichment.confidence!
          : 0.6,
      lastScraped: new Date().toISOString(),
      benefitsDetail,
      rewardsRotating: enrichment?.rewardsRotating,
      merchantCredits: sanitizeCredits(enrichment?.merchantCredits),
      recurringCredits: sanitizeCredits(enrichment?.recurringCredits),
      access: enrichment?.access,
      insurances: enrichment?.insurances,
    };

    const override = CARD_OVERRIDES[slug];
    if (override) {
      result.name = override.name ?? result.name;
      result.issuer = override.issuer ?? result.issuer;
      result.annualFee = override.annualFee ?? result.annualFee;
      result.apr = override.apr ?? result.apr;
      result.rewardsByCategory = override.rewardsByCategory ?? result.rewardsByCategory;
      result.perks = override.perks ?? result.perks;
      result.signupOffer = override.signupOffer ?? result.signupOffer;
      result.merchantCredits = sanitizeCredits(override.merchantCredits ?? result.merchantCredits);
      result.recurringCredits = sanitizeCredits(override.recurringCredits ?? result.recurringCredits);
      if (override.benefitsDetail) result.benefitsDetail = override.benefitsDetail;
    }

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

/** Optional bulk orchestrator stub */
export async function runScrapers(issuers?: string[]) {
  return (issuers || []).map((issuer) => ({ issuer, count: 0, confidence: 0 }));
}

// --------------------
// CLI runner (manual):
// ts-node src/scrapers/scrapeCard.ts "<url>" "<slug>"
// --------------------
if (require.main === module) {
  (async () => {
    const url = process.argv[2];
    const inferSlugFromUrl = (rawUrl: string): string => {
      try {
        const u = new URL(rawUrl);
        const parts = u.pathname.split("/").filter(Boolean);
        const last = parts[parts.length - 1] || "unknown-card";
        return last
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      } catch {
        return "unknown-card";
      }
    };

    const slug = process.argv[3] || inferSlugFromUrl(url || "");
    if (!url) {
      console.error('Usage: ts-node src/scrapers/scrapeCard.ts "<url>" "<slug>"');
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
      apr: res?.apr ?? existing?.apr ?? null,
      issuer: res?.issuer ?? existing?.issuer ?? null,
      benefitsDetail: res?.benefitsDetail ?? existing?.benefitsDetail,
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

    await col.updateOne({ slug }, { $set: merged } as UpdateFilter<StoredCard>, { upsert: true });

    if (res?.benefitsDetail) {
      const historyCol: Collection<BenefitsHistoryEntry> =
        db.collection<BenefitsHistoryEntry>("benefits_history");
      const hash = hashBenefits(res.benefitsDetail);
      const last = await historyCol.find({ slug }).sort({ scrapedAt: -1 }).limit(1).toArray();
      if (!last[0] || last[0].hash !== hash) {
        await historyCol.insertOne({
          slug,
          scrapedAt: res.benefitsDetail.lastScraped || new Date().toISOString(),
          sourceUrl: res.sourceUrl ?? url,
          benefits: res.benefitsDetail,
          hash,
        });
        console.log("🧾 Recorded benefits history snapshot");
      } else {
        console.log("🧾 Benefits unchanged; history snapshot skipped");
      }
    }

    const stored = await col.findOne({ slug });
    console.log("✅ Upserted:", stored?.slug || slug);
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
