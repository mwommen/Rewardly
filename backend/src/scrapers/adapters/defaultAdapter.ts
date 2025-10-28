// backend/scrapers/adapters/defaultAdapter.ts
import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";
import {
  extractAnnualFeeFromText,
  extractPerksFromText,
  extractRewardsFromText
} from "../parsers/textParsers";

export const defaultAdapter: ScrapeAdapter = {
  id: "default",
  matches: () => true,

  async run(page: Page, _url: string) {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const text = await page.locator("body").innerText();

    const annualFee = extractAnnualFeeFromText(text);
    const rewardsByCategory = extractRewardsFromText(text);
    const perks = extractPerksFromText(text);

    // Try to guess a name generically
    const nameMatch = text.match(/(Visa|Mastercard|American Express|Discover).*?(Card)/i);
    const name = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : "Credit Card";

    return { issuer: null, name, annualFee, rewardsByCategory, perks };
  },
};
