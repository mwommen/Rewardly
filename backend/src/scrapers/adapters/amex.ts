// backend/scrapers/adapters/amex.ts
import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";
import {
  extractAnnualFeeFromText,
  extractPerksFromText,
  extractRewardsFromText,
} from "../parsers/textParsers";

export const amexAdapter: ScrapeAdapter = {
  id: "amex",
  matches: (url) => /americanexpress\.com/.test(url),

  async run(page: Page, _url: string) {
    // Light scroll to trigger lazy loads
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(800);
    }

    // Capture JSON blobs while page loads
    let jsonBlob = "";
    const handler = async (resp: any) => {
      try {
        const u = resp.url();
        if ((/cdaas|one\/app|api|\.json/i).test(u) && resp.status() === 200) {
          const ct = resp.headers()["content-type"] || "";
          if (ct.includes("application/json")) {
            const body = await resp.text();
            if (body.length > jsonBlob.length) jsonBlob = body; // keep largest
          }
        }
      } catch {}
    };
    page.on("response", handler);

    await page.waitForSelector("body", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    // Safely remove listener (cross-version compatible)
    try {
      page.removeListener("response", handler);
    } catch {}

    // Text fallback + try parsing JSON for reward data
    const bodyText = await page.locator("body").innerText();
    let text = bodyText;

    if (jsonBlob && jsonBlob.length > 2000) {
      try {
        const parsed = JSON.parse(jsonBlob);
        const jsonString = JSON.stringify(parsed);
        if (jsonString.includes("Membership Rewards") || jsonString.includes("Points")) {
          text += "\n" + jsonString;
          console.log("🧠 Extracted rewards info from JSON blob.");
        }
      } catch {
        // ignore if invalid JSON
      }
    }

    const nameMatch = text.match(/(American Express.*?(Gold|Platinum|Blue|Cash|Everyday).*?Card)/i);
    const name = nameMatch ? nameMatch[1].trim() : "American Express Card";

    const annualFee = extractAnnualFeeFromText(text);
    const rewardsByCategory = extractRewardsFromText(text);
    const perks = extractPerksFromText(text);


    return {
      issuer: "American Express",
      name,
      annualFee,
      rewardsByCategory,
      perks,
    };
  },
};
