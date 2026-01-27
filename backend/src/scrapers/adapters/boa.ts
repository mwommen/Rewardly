// backend/src/scrapers/adapters/boa.ts
import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";
import {
  extractAnnualFeeFromText,
  extractPerksFromText,
  extractRewardsFromText,
} from "../parsers/textParsers";

export const boaAdapter: ScrapeAdapter = {
  id: "boa",
  matches: (url) => /bankofamerica\.com/.test(url),

  async run(page: Page, _url: string) {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const annualFee = extractAnnualFeeFromText(bodyText);
    const rewardsByCategory = extractRewardsFromText(bodyText);
    const perks = extractPerksFromText(bodyText);

    let name = "";
    try {
      const h1 = await page.locator("h1").first().innerText();
      name = h1?.trim() || "";
    } catch {}
    if (!name) {
      try {
        const title = await page.title();
        name = title?.replace(/\s+\|\s+Bank of America.*/i, "").trim() || "";
      } catch {}
    }
    if (!name) name = "Bank of America Card";

    return {
      issuer: "Bank of America",
      name,
      annualFee,
      rewardsByCategory,
      perks,
    };
  },
};
