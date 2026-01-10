import type { Page } from "playwright";
import type { ScrapeAdapter, PartialCard } from "./base";

function normalizeCategory(raw: string) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("grocery")) return "groceries";
  if (s.includes("dining") || s.includes("restaurant")) return "dining";
  if (s.includes("travel") || s.includes("airfare") || s.includes("airlines")) return "travel";
  if (s.includes("online")) return "online_shopping";
  if (s.includes("gas")) return "gas";
  if (s.includes("drugstore") || s.includes("pharmacy")) return "drugstore";
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
      const perks: string[] = [];

      const rewardBlocks = json?.card?.rewards || json?.rewards || json?.benefits || [];
      for (const r of Array.isArray(rewardBlocks) ? rewardBlocks : []) {
        const text = (r?.description || r?.title || r?.copy || "").toString();
        const low = text.toLowerCase();
        const n = (() => {
          const m = low.match(/(\d+(?:\.\d+)?)/);
          return m ? Number(m[1]) : null;
        })();
        if (n != null) {
          if (low.includes("travel")) rewardsByCategory["travel"] = Math.max(rewardsByCategory["travel"] || 0, n);
          if (low.includes("dining")) rewardsByCategory["dining"] = Math.max(rewardsByCategory["dining"] || 0, n);
          if (low.includes("grocery")) rewardsByCategory["groceries"] = Math.max(rewardsByCategory["groceries"] || 0, n);
          if (low.includes("gas")) rewardsByCategory["gas"] = Math.max(rewardsByCategory["gas"] || 0, n);
          if (low.includes("online")) rewardsByCategory["online_shopping"] = Math.max(rewardsByCategory["online_shopping"] || 0, n);
        }
        if (r?.description) perks.push(r.description);
        else if (r?.title) perks.push(r.title);
      }

      const benefitBlocks = json?.benefits || json?.card?.benefits || [];
      for (const b of Array.isArray(benefitBlocks) ? benefitBlocks : []) {
        if (typeof b === "string") perks.push(b);
        else if (b?.title || b?.description) perks.push(`${b.title || ""} ${b.description || ""}`.trim());
      }

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

    const rewardsByCategory: Record<string, number> = {};
    const rewardRegex = /(\d+(?:\.\d+)?)\s*(?:x|X|%)(?:\s*(?:points|back|cash back))?\s*(?:on|at|for)\s+([a-zA-Z\s]+)/g;
    for (const m of text.matchAll(rewardRegex)) {
      const n = Number(m[1]);
      const cat = normalizeCategory(m[2] || "");
      if (cat && Number.isFinite(n)) rewardsByCategory[cat] = Math.max(rewardsByCategory[cat] || 0, n);
    }

    // perks & signup
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
