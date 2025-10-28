import type { Page } from "playwright";
import type { ScrapeAdapter, PartialCard } from "./base";

function normalizeCategory(raw: string) {
  const s = (raw || "").toLowerCase();
  if (s.includes("grocery")) return "groceries";
  if (s.includes("dining") || s.includes("restaurant")) return "dining";
  if (s.includes("travel")) return "travel";
  if (s.includes("online")) return "online_shopping";
  if (s.includes("gas")) return "gas";
  return null;
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

    let text = "";
    try {
      text = await page.locator("main, body").innerText({ timeout: 5000 });
    } catch {
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

    const rewardsByCategory: Record<string, number> = {};
    const rewardRegex =
      /(\d+(?:\.\d+)?)\s*(?:x|X|%)(?:\s*(?:points|back|cash back))?\s*(?:on|at|for)\s+([a-zA-Z\s]+)/g;
    for (const m of text.matchAll(rewardRegex)) {
      const n = Number(m[1]);
      const cat = normalizeCategory(m[2] || "");
      if (cat && Number.isFinite(n)) rewardsByCategory[cat] = Math.max(rewardsByCategory[cat] || 0, n);
    }

    const perks: string[] = [];
    for (const line of text.split(/\n|•|–|—|\./).map((s) => s.trim())) {
      if (/points|miles|cash back|credit|travel|dining|lounge|protection|warranty|insurance/i.test(line) && line.length > 25) {
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
