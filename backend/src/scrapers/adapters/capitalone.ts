import type { Page } from "playwright";
import type { ScrapeAdapter } from "./base";
import {
  extractAnnualFeeFromText,
  extractRewardsFromText,
} from "../parsers/textParsers";

function nameFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("venture-x")) return "Capital One Venture X";
  if (u.includes("savorone")) return "Capital One SavorOne";
  if (u.includes("venture")) return "Capital One Venture";
  return "Capital One Card";
}

function cleanPerks(lines: string[], cardName?: string): string[] {
  const keepers: string[] = [];
  const seen = new Set<string>();
  const normalizedCardName = (cardName || "").toLowerCase();

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || line.length < 12 || line.length > 180) continue;
    if (normalizedCardName && line.toLowerCase().includes(normalizedCardName)) continue;
    if (/earn\s+[\d,]+\s+.*?bonus\s+points/i.test(line)) continue;
    if (/reward(s)? program|credit cards? offers|opens new credit card offers/i.test(line)) continue;
    if (/privacy|cookie|consent|javascript|@charset|<script|<\/script/i.test(line)) continue;
    if (/annual fee/i.test(line)) keepers.push(line);
    if (/intro apr|0%/i.test(line)) keepers.push(line);
    if (/purchase protection|extended warranty|travel insurance|cell phone protection/i.test(line)) keepers.push(line);
    if (/transfer partners|points transfer/i.test(line)) keepers.push(line);
    if (/airport lounge|priority pass|tsa precheck|global entry/i.test(line)) keepers.push(line);
    if (/cash back|miles|rewards|credit/i.test(line)) keepers.push(line);
  }

  return keepers
    .map((s) => s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return s.length > 6 && s.length < 180;
    })
    .slice(0, 10);
}

export const capitalOneAdapter: ScrapeAdapter = {
  id: "capitalone",
  matches: (url: string) => /capitalone\.com\/credit-cards/i.test(url),

  async run(page: Page, url: string) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(1200).catch(() => {});

    let text = await page.locator("main").innerText().catch(() => "");
    if (!text || text.trim().length < 500) {
      text = await page.locator("body").innerText().catch(() => "");
    }
    const annualFee = extractAnnualFeeFromText(text);
    const rewardsByCategory = extractRewardsFromText(text);
    const perks = cleanPerks(text.split(/\n|•|–|—|\./).map((s) => s.trim()), nameFromUrl(url));

    return {
      issuer: "Capital One",
      name: nameFromUrl(url),
      annualFee,
      rewardsByCategory,
      perks,
      sourceUrl: url,
      confidence: 0.6,
    };
  },
};
