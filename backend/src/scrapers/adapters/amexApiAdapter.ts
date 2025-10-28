import type { ScrapeAdapter } from "./base";
import type { Page } from "playwright";
import {
  extractAnnualFeeFromText,
  extractPerksFromText,
  extractRewardsFromText,
} from "../parsers/textParsers";

async function discoverAmexAppBases(page: Page): Promise<string[]> {
  // Find script tags that load the SPA bundle with versioned path:
  // https://www.aexp-static.com/cdaas/one/app/<version>/* 
  const srcs = await page
    .locator('script[src*="aexp-static.com/cdaas/one/app/"]')
    .evaluateAll((nodes) => nodes.map((n: any) => n.src as string).filter(Boolean));

  const bases = new Set<string>();
  for (const src of srcs) {
    // extract "https://www.aexp-static.com/cdaas/one/app/<version>/" prefix
    const m = src.match(/^(https:\/\/www\.aexp-static\.com\/cdaas\/one\/app\/[^/]+)\//i);
    if (m) bases.add(m[1] + "/");
  }
  return Array.from(bases);
}

function buildCandidateApiUrls(bases: string[], slug: string): string[] {
  // Try multiple likely API shapes the site has used over time.
  const suffixes = [
    `api/v1/creditcards/${slug}?locale=en-US`,
    `api/v1/creditcards/${slug}`,
    `api/v1/cards/${slug}?locale=en-US`,
    `api/v1/product/${slug}?locale=en-US`,
    `api/creditcards/${slug}?locale=en-US`,
  ];
  const urls: string[] = [];
  for (const base of bases) {
    for (const sfx of suffixes) urls.push(base + sfx);
  }
  return urls;
}

function extractSlugFromUrl(url: string): string {
  // e.g. https://www.americanexpress.com/us/credit-cards/card/amex-gold-card/
  // or .../card/blue-cash-everyday/
  const m = url.match(/\/card\/([a-z0-9-]+)(?:\/|$)/i);
  return m ? m[1] : "unknown";
}

export const amexApiAdapter: ScrapeAdapter = {
  id: "amex-api",
  matches: (url) => /americanexpress\.com/.test(url),

  async run(page: Page, url: string) {
    // Let the page render some to ensure scripts are present
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    const slug = extractSlugFromUrl(url);
    const bases = await discoverAmexAppBases(page);

    console.log("🔎 Discovered Amex app bases:", bases);

    // Collect JSON blobs from *all* responses while we probe
    let biggestJson = "";
    const jsonSniffer = async (resp: any) => {
      try {
        const ct = (resp.headers()["content-type"] || "").toLowerCase();
        if (ct.includes("application/json") && resp.status() === 200) {
          const body = await resp.text();
          // Keep the largest JSON blob that mentions 'card', 'rewards', etc.
          if (body.length > biggestJson.length && /card|rewards|points|membership/i.test(body)) {
            biggestJson = body;
          }
        }
      } catch {}
    };
    page.on("response", jsonSniffer);

    // Try direct API fetches using discovered bases
    const candidates = buildCandidateApiUrls(bases, slug);
    let liveJson: any | null = null;

    for (const apiUrl of candidates) {
      try {
        console.log("🔗 Trying Amex API:", apiUrl);
        const resp = await page.request.get(apiUrl, {
          headers: { Referer: url, Accept: "application/json" },
          timeout: 15000,
        });
        if (resp.ok()) {
          liveJson = await resp.json();
          console.log("✅ Amex API success:", apiUrl);
          break;
        } else {
          console.log(`↩️ Amex API ${resp.status()} at ${apiUrl}`);
        }
      } catch (e) {
        console.log("⚠️ Amex API fetch error:", (e as Error).message);
      }
    }

    // Stop sniffing
    try {
      page.removeListener("response", jsonSniffer);
    } catch {}

    // Build a single big text pool to parse regardless of source
    let textPool = "";
    let name: string | undefined;

    if (liveJson) {
      const details = liveJson?.details || liveJson?.pageData || liveJson;
      textPool += JSON.stringify(details);
      name =
        liveJson?.productName ||
        liveJson?.seo?.title ||
        liveJson?.title ||
        undefined;
    }

    // Fallback: parse biggest JSON sniffed from responses
    if (!textPool && biggestJson) {
      console.log("🧠 Using sniffed JSON fallback.");
      textPool = biggestJson;
    }

    // Last-resort: page text (may be sparse on Amex)
    if (!textPool) {
      const bodyText = await page.locator("body").innerText();
      textPool = bodyText;
    }

    // Basic field extraction
    if (!name) {
      const nMatch = textPool.match(/(American Express.*?(Gold|Blue|Platinum|Cash|Everyday).*?Card)/i);
      name = nMatch ? nMatch[1].trim() : `American Express ${slug.replace(/-/g, " ")}`;
    }

    const annualFee = extractAnnualFeeFromText(textPool);
    const rewardsByCategory = extractRewardsFromText(textPool);
    const perks = extractPerksFromText(textPool);

    console.log("✅ Parsed Amex data:", {
      name,
      annualFee,
      rewardsByCategory,
      samplePerk: perks[0],
    });

    return {
      issuer: "American Express",
      name: name || `American Express ${slug}`,
      annualFee: annualFee ?? null,
      rewardsByCategory,
      perks,
      sourceUrl: url,
    };
  },
};
