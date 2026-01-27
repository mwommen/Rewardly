// backend/scrapers/adapters/usbank.ts
import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";
import {
  extractAnnualFeeFromText,
  extractPerksFromText,
  extractRewardsFromText,
} from "../parsers/textParsers";

export const usbankAdapter: ScrapeAdapter = {
  id: "usbank",
  matches: (url) => /usbank\.com/.test(url),

  async run(page: Page, _url: string) {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 20000 });
    } catch {}
    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {}
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
        name = title?.replace(/\s+\|\s+U\.S\.\s*Bank.*/i, "").trim() || "";
      } catch {}
    }
    if (!name) name = "U.S. Bank Card";

    return {
      issuer: "U.S. Bank",
      name,
      annualFee,
      rewardsByCategory,
      perks,
    };
  },
};
