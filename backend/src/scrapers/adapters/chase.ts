import type { Page } from "playwright";
import type { ScrapeAdapter, PartialCard } from "./base";

function categoriesFromText(raw: string): string[] {
  const s = (raw || "").toLowerCase();
  const out: string[] = [];
  if (s.includes("grocery") || s.includes("supermarket")) out.push("groceries");
  if (s.includes("dining") || s.includes("restaurant")) out.push("dining");
  if (s.includes("travel") || s.includes("chase travel") || s.includes("airfare")) out.push("travel");
  if (s.includes("online")) out.push("online_shopping");
  if (s.includes("gas")) out.push("gas");
  if (s.includes("drugstore") || s.includes("pharmacy")) out.push("drugstore");
  if (s.includes("all other") || s.includes("other purchases") || s.includes("everywhere")) out.push("other");
  return Array.from(new Set(out));
}

function parseRate(raw: string, unit: string): number | null {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  if (unit === "%") return n / 100;
  return n;
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

function productNameFromUrl(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes("sapphire-preferred")) return "Chase Sapphire Preferred®";
  if (u.includes("sapphire-reserve")) return "Chase Sapphire Reserve®";
  if (u.includes("freedom-unlimited")) return "Chase Freedom Unlimited®";
  if (u.includes("freedom-flex")) return "Chase Freedom Flex℠";
  return null;
}

export const chaseAdapter: ScrapeAdapter = {
  id: "chase",
  matches: (url: string) => /creditcards\.chase\.com/i.test(url),

  run: async (page: Page, url: string) => {
    await Promise.all([
      page.locator('button:has-text("Accept")').click({ timeout: 1500 }).catch(() => {}),
      page.locator('button:has-text("I Accept")').click({ timeout: 1500 }).catch(() => {}),
    ]);

    let text = await page.locator("main").innerText({ timeout: 5000 }).catch(() => "");
    if (!text || text.trim().length < 500) {
      text = await page.locator("body").innerText().catch(() => "");
    }

    const h1 = await page.locator("h1").first().textContent().catch(() => null);
    let name = h1?.trim() || "Chase Card";
    const nameMatch = text.match(/(Sapphire Preferred|Sapphire Reserve|Freedom Flex|Freedom Unlimited)/i);
    if (nameMatch) name = `Chase ${nameMatch[1].trim()}`;
    name = productNameFromUrl(url) || name;

    let annualFee: number | null = null;
    const feeMatch = text.match(/Annual Fee[^$]*(\$?\s*\d{2,4})/i);
    if (feeMatch) annualFee = Number(feeMatch[1].replace(/[^0-9]/g, ""));

    const rewardsByCategory = extractRewards(text);

    const perks: string[] = [];
    for (const line of text.split(/\n|•|–|—|\./).map((s) => s.trim())) {
      if (!line || line.length < 20) continue;
      if (/opens new credit card offers|credit cards? offers|reward(s)? program|credit card offers/i.test(line)) continue;
      if (/points|miles|cash back|credit|travel|dining|lounge|protection|warranty|insurance|dashpass|door\s*dash/i.test(line)) {
        perks.push(line);
        if (perks.length >= 12) break;
      }
    }

    let signupOffer: string | null = null;
    const offerMatch = text.match(/earn\s+[\d,]+\s+(?:bonus\s+)?points.*?(?:after|when)\s+.*?\./i);
    if (offerMatch) signupOffer = offerMatch[0].trim();

    const confidence =
      (name ? 0.3 : 0) +
      (annualFee != null ? 0.2 : 0) +
      (Object.keys(rewardsByCategory).length ? 0.3 : 0) +
      (signupOffer ? 0.2 : 0);

    const result: PartialCard = {
      name,
      issuer: "Chase",
      annualFee,
      rewardsByCategory,
      perks,
      signupOffer,
      sourceUrl: url,
      confidence,
    };

    return result;
  },
};
