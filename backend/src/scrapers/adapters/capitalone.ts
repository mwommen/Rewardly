import type { Page } from "playwright";
import type { ScrapeAdapter } from "./base";
import {
  extractAnnualFeeFromText,
  extractPerksFromText,
  extractRewardsFromText
} from "../parsers/textParsers";

function nameFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("venture-x")) return "Capital One Venture X";
  if (u.includes("savorone")) return "Capital One SavorOne";
  if (u.includes("venture")) return "Capital One Venture";
  return "Capital One Card";
}

export const capitalOneAdapter: ScrapeAdapter = {
  id: "capitalone",
  matches: (url: string) => /capitalone\.com\/credit-cards/i.test(url),

  async run(page: Page, url: string) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(1200).catch(() => {});

    const text = await page.locator("body").innerText().catch(() => "");
    const annualFee = extractAnnualFeeFromText(text);
    const rewardsByCategory = extractRewardsFromText(text);
    const perks = extractPerksFromText(text);

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
