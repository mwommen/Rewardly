import type { Page } from "playwright";
import type { ScrapeAdapter, PartialCard } from "./base";

function categoriesFromText(raw: string): string[] {
  if (!raw) return [];
  const s = raw.toLowerCase();
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

function extractRewardsFromText(text: string): Record<string, number> {
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
  const out: string[] = [];
  const seen = new Set<string>();
  const normalizedCardName = (cardName || "").toLowerCase();
  for (const lineRaw of lines) {
    const line = lineRaw.replace(/\s+/g, " ").trim();
    if (!line || line.length < 20 || line.length > 160) continue;
    if (normalizedCardName && line.toLowerCase().includes(normalizedCardName)) continue;
    if (/opens new credit card offers|credit cards? offers|reward(s)? program|credit card offers/i.test(line)) continue;
    if (!/points|miles|cash back|credit|travel|dining|lounge|protection|warranty|insurance|dashpass|door\s*dash/i.test(line)) {
      continue;
    }
    if (/earn\s+[\d,]+\s+.*?bonus\s+points/i.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 12) break;
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

function annualFeeOverrideFromUrl(url: string): number | null {
  const u = url.toLowerCase();
  if (u.includes("freedom-unlimited")) return 0;
  if (u.includes("freedom-flex")) return 0;
  if (u.includes("sapphire-preferred")) return 95;
  if (u.includes("sapphire-reserve")) return 550;
  return null;
}

function computeConfidence(p: PartialCard) {
  return (
    (p.name ? 0.3 : 0) +
    (p.annualFee != null ? 0.2 : 0) +
    (p.rewardsByCategory && Object.keys(p.rewardsByCategory).length ? 0.3 : 0) +
    (p.signupOffer ? 0.2 : 0)
  );
}

export const chaseApiAdapter: ScrapeAdapter = {
  id: "chase-api",
  matches: (url: string) => /creditcards\.chase\.com/i.test(url),

  run: async (page: Page, url: string) => {
    // try to close cookie banners (best-effort)
    await page.waitForTimeout(600).catch(() => {});
    await Promise.all([
      page.locator('button:has-text("Accept")').click({ timeout: 1500 }).catch(() => {}),
      page.locator('button:has-text("I Accept")').click({ timeout: 1500 }).catch(() => {}),
      page.locator('button:has-text("Accept All")').click({ timeout: 1500 }).catch(() => {}),
    ]);

    // Sniff relevant JSON XHR/fetch
    let bestJson: any = null;
    const onResponse = async (resp: any) => {
      try {
        const type = resp.request().resourceType();
        const status = resp.status();
        const ct = (resp.headers()["content-type"] || "").toLowerCase();
        if ((type === "xhr" || type === "fetch") && status === 200 && ct.includes("application/json")) {
          const txt = await resp.text();
          if (!txt || txt.length < 50) return;
          const looksRelevant = /card|rewards|bonus|annual\s*fee|points|offer|benefit/i.test(txt);
          if (!looksRelevant) return;
          try {
            const parsed = JSON.parse(txt);
            if (!bestJson || txt.length > JSON.stringify(bestJson).length) bestJson = parsed;
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };
    page.on("response", onResponse);

    // Scroll to trigger lazy resources
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(900);
    }

    // Poll up to ~30s for JSON
    const start = Date.now();
    while (Date.now() - start < 30_000) {
      if (bestJson) break;
      await page.waitForTimeout(800);
    }

    try { page.off("response", onResponse); } catch {}

    // If we captured JSON, parse it
    if (bestJson) {
      const json = bestJson;
      let name =
        json?.card?.displayName ||
        json?.title ||
        json?.cardName ||
        json?.seoTitle ||
        json?.name ||
        "Chase Card";

      // URL-authoritative name override
      name = productNameFromUrl(url) || name;

      const annualFee =
        annualFeeOverrideFromUrl(url) ??
        json?.card?.annualFee ??
        json?.details?.annualFee ??
        json?.annualFee ??
        null;

      const rewardsByCategory: Record<string, number> = {};
      const rawPerks: string[] = [];

      const rewardBlocks = json?.card?.rewards || json?.rewards || json?.benefits || [];
      for (const r of Array.isArray(rewardBlocks) ? rewardBlocks : []) {
        const text = (r?.description || r?.title || r?.copy || "").toString();
        const low = text.toLowerCase();
        const rates = extractRewardsFromText(text);
        for (const [cat, rate] of Object.entries(rates)) {
          rewardsByCategory[cat] = Math.max(rewardsByCategory[cat] || 0, rate);
        }
        if (r?.description) rawPerks.push(r.description);
        else if (r?.title) rawPerks.push(r.title);
      }

      const benefitBlocks = json?.benefits || json?.card?.benefits || [];
      for (const b of Array.isArray(benefitBlocks) ? benefitBlocks : []) {
        if (typeof b === "string") rawPerks.push(b);
        else if (b?.title || b?.description) rawPerks.push(`${b.title || ""} ${b.description || ""}`.trim());
      }
      const perks = cleanPerks(rawPerks, name);

      const signupOffer =
        json?.offer?.headline ||
        json?.offer?.shortDescription ||
        json?.signupOffer?.headline ||
        null;

      const partial: PartialCard = {
        name,
        issuer: "Chase",
        annualFee,
        rewardsByCategory,
        perks,
        signupOffer,
        sourceUrl: url,
      };
      partial.confidence = computeConfidence(partial);
      return partial;
    }

    // Fallback: visible text
    let text = "";
    try {
      text = await page.locator("main, body").innerText({ timeout: 4000 });
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

    const rewardsByCategory = extractRewardsFromText(text);

    // perks & signup
    const perks = cleanPerks(text.split(/\n|•|–|—|\./).map((s) => s.trim()), name);
    let signupOffer: string | null = null;
    const offerMatch = text.match(/earn\s+[\d,]+\s+(?:bonus\s+)?points.*?(?:after|when)\s+.*?\./i);
    if (offerMatch) signupOffer = offerMatch[0].trim();

    const partial: PartialCard = {
      name,
      issuer: "Chase",
      annualFee,
      rewardsByCategory,
      perks,
      signupOffer,
      sourceUrl: url,
    };
    partial.confidence = computeConfidence(partial);
    return partial;
  },
};
