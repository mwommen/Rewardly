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
  if (m) return m[1];
  const alt = url.match(/\/([a-z0-9-]+)\/?$/i);
  return alt ? alt[1] : "unknown";
}

function buildAmexSlugVariants(rawSlug: string): string[] {
  const slug = rawSlug.toLowerCase();
  const variants = new Set<string>();
  const add = (v?: string) => {
    if (!v) return;
    const trimmed = v.replace(/^-+|-+$/g, "");
    if (trimmed) variants.add(trimmed);
  };

  add(slug);
  add(slug.replace(/^amex-/, ""));
  add(slug.replace(/-card$/, ""));
  add(slug.replace(/-credit-card$/, ""));
  add(slug.replace(/-credit$/, ""));
  add(slug.replace(/^amex-/, "").replace(/-card$/, ""));
  add(slug.replace(/^amex-/, "").replace(/-credit-card$/, ""));

  if (slug.includes("gold")) add("gold");
  if (slug.includes("platinum")) add("platinum");
  if (slug.includes("green")) add("green");
  if (slug.includes("everyday-preferred")) add("everyday-preferred");
  if (slug.includes("everyday")) add("everyday");
  if (slug.includes("blue-business-plus")) {
    add("blue-business-plus");
    add("bluebusinessplus");
    add("bluebusiness-plus");
  }

  return Array.from(variants);
}

function buildCardshopApiUrls(slugs: string[]): string[] {
  const hosts = [
    "https://daconsumershop.americanexpress.com",
    "https://cardshop.americanexpress.com",
  ];
  const urls: string[] = [];
  for (const host of hosts) {
    for (const slug of slugs) {
      urls.push(`${host}/us/cardshop-api/api/v1/cps/content/cd/${slug}/`);
      urls.push(`${host}/us/cardshop-api/api/v1/cps/content/bd/${slug}/`);
    }
  }
  return urls;
}

function discoverCardshopUrlsFromHtml(html: string): string[] {
  const matches = new Set<string>();
  const re = /https:\/\/daconsumershop\.americanexpress\.com\/us\/cardshop-api\/api\/v1\/cps\/content\/(?:cd|bd)\/[^"'\s)]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    matches.add(m[0]);
  }
  return Array.from(matches);
}

function discoverCardshopCandidatesFromHtml(html: string): string[] {
  const urls = new Set<string>();
  const base = "https://daconsumershop.americanexpress.com/us/cardshop-api/api/v1/cps/content";

  // Absolute URLs
  for (const url of discoverCardshopUrlsFromHtml(html)) urls.add(url);

  // Relative paths like /us/cardshop-api/api/v1/cps/content/cd/green/
  const relRe = /\/us\/cardshop-api\/api\/v1\/cps\/content\/(?:cd|bd)\/[^"'\s)]+/gi;
  let m: RegExpExecArray | null;
  while ((m = relRe.exec(html))) {
    urls.add(`https://daconsumershop.americanexpress.com${m[0]}`);
  }

  // Numeric contentId patterns
  const idRe = /"(?:contentId|cardId|contentID)"\s*:\s*"?(\d{4,})"?/gi;
  while ((m = idRe.exec(html))) {
    const id = m[1];
    urls.add(`${base}/cd/${id}/`);
    urls.add(`${base}/bd/${id}/`);
  }

  return Array.from(urls);
}

function discoverCardshopIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  const idRe = /"(?:contentId|cardId|contentID)"\s*:\s*"?(\d{4,})"?/gi;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(html))) {
    ids.add(m[1]);
  }
  return Array.from(ids);
}

function extractMetaInfoFromHtml(html: string): { title?: string; description?: string; text: string } {
  const parts: string[] = [];
  const first = (re: RegExp) => {
    const m = re.exec(html);
    return m?.[1]?.trim() || "";
  };
  const all = (re: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const content = m[1]?.trim();
      if (content) parts.push(content);
    }
  };

  const title =
    first(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    first(/<meta[^>]+name="twitter:title"[^>]+content="([^"]+)"/i) ||
    first(/<title[^>]*>([^<]+)<\/title>/i);

  const description =
    first(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
    first(/<meta[^>]+name="twitter:description"[^>]+content="([^"]+)"/i) ||
    first(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);

  all(/<title[^>]*>([^<]+)<\/title>/gi);
  all(/<meta[^>]+name="description"[^>]+content="([^"]+)"/gi);
  all(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/gi);
  all(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/gi);
  all(/<meta[^>]+name="twitter:title"[^>]+content="([^"]+)"/gi);
  all(/<meta[^>]+name="twitter:description"[^>]+content="([^"]+)"/gi);

  return { title: title || undefined, description: description || undefined, text: parts.join(" ") };
}

function isBadMetaTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (t === "search") return true;
  if (t.includes("american express credit cards") && t.length > 40) return true;
  return false;
}

function parseRewardsFromMetaDescription(desc: string): Record<string, number> {
  const rewards: Record<string, number> = {};
  const text = desc.replace(/\bU\.S\./gi, "US").replace(/\bU\.S\b/gi, "US").toLowerCase();

  const add = (category: string, rate: number) => {
    if (!category) return;
    rewards[category] = Math.max(rewards[category] || 0, rate);
  };

  const catFromPhrase = (phrase: string): string => {
    if (/supermarket|grocery/.test(phrase)) return "groceries";
    if (/gas station|gas\b/.test(phrase)) return "gas";
    if (/restaurant|dining/.test(phrase)) return "dining";
    if (/travel|airfare|flights|airlines|hotel/.test(phrase)) return "travel";
    if (/transit|rideshare|subway|train|parking|toll|bus/.test(phrase)) return "transit";
    if (/online retail|online purchase|online/.test(phrase)) return "online_shopping";
    if (/all other eligible purchases|other purchases/.test(phrase)) return "other";
    return phrase.trim().replace(/\s+/g, " ");
  };

  const rx = /(\d+)x\s+points?\s+(?:at|on)\s+([^,;]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const rate = Number(m[1]);
    const phrase = (m[2] || "").replace(/\.$/, "");
    const category = catFromPhrase(phrase);
    if (!Number.isNaN(rate) && category) add(category, rate);
  }

  if (/1x\s+points?\s+on\s+all\s+other\s+eligible\s+purchases/.test(text)) {
    add("other", 1);
  }

  return rewards;
}

function extractNearbyText(text: string, needle: string, radius = 2000): string {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return text.slice(start, end);
}

async function getUserAgent(page: Page): Promise<string | undefined> {
  try {
    const ua = await page.evaluate(() => navigator.userAgent);
    return ua || undefined;
  } catch {}
  try {
    // Playwright context can expose UA
    // @ts-expect-error - userAgent may not exist on all contexts
    const ua = page.context().userAgent?.();
    return ua || undefined;
  } catch {}
  return undefined;
}

function pickCardData(raw: any): any | null {
  if (!raw) return null;
  if (raw.cardData) return raw.cardData;
  if (raw.data?.cardData) return raw.data.cardData;
  if (raw.pageData?.cardData) return raw.pageData.cardData;
  return null;
}

export const amexApiAdapter: ScrapeAdapter = {
  id: "amex-api",
  matches: (url) => /americanexpress\.com/.test(url),

  async run(page: Page, url: string) {
    // Let the page render some to ensure scripts are present
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    const slug = extractSlugFromUrl(url);
    const slugVariants = buildAmexSlugVariants(slug);
    const ua = await getUserAgent(page);

    // Watch for cardshop API calls the page itself makes
    const sniffedApiUrls = new Set<string>();
    const cardshopListener = (resp: any) => {
      try {
        const rurl = resp.url();
        if (/cardshop-api\/api\/v1\/cps\/content\/(?:cd|bd)\//i.test(rurl)) {
          sniffedApiUrls.add(rurl);
        }
      } catch {}
    };
    page.on("response", cardshopListener);

    let html = "";
    try {
      html = await page.content();
    } catch {}

    let metaText = "";
    let metaTitle: string | undefined;
    let metaDescription: string | undefined;
    if (html) {
      const metaInfo = extractMetaInfoFromHtml(html);
      metaTitle = metaInfo.title;
      metaDescription = metaInfo.description;
      metaText = metaInfo.text;
      if (metaText) {
        console.log("🧾 Meta text found:", metaText.slice(0, 200));
      }
    }

    let stateText = "";
    try {
      const state = await page.evaluate(() => {
        // Common global state keys used by Amex properties
        const w = window as unknown as Record<string, unknown>;
        return w.__INITIAL_STATE__ || w.__PRELOADED_STATE__ || w.__APOLLO_STATE__ || w.__NUXT__ || null;
      });
      if (typeof state === "string") stateText = state;
      else if (state && typeof state === "object") stateText = JSON.stringify(state);
    } catch {}

    let stateSnippet = "";
    if (stateText) {
      const needles = [
        slug,
        ...slugVariants,
        slug.replace(/-/g, " "),
        slug.replace(/-/g, ""),
      ];
      for (const needle of needles) {
        const snip = extractNearbyText(stateText, needle, 3000);
        if (snip) {
          stateSnippet = snip;
          console.log("🧩 Matched state snippet for:", needle);
          break;
        }
      }
    }

    // Try direct cardshop API (consumer + business)
    const cardshopCandidates = buildCardshopApiUrls(slugVariants);
    const discoveredFromHtml = html ? discoverCardshopCandidatesFromHtml(html) : [];
    const allCandidates = [...sniffedApiUrls, ...discoveredFromHtml, ...cardshopCandidates];
    let liveJson: any | null = null;
    let liveSource: string | null = null;

    if (html) {
      const ids = discoverCardshopIdsFromHtml(html);
      if (discoveredFromHtml.length || ids.length) {
        console.log("🔎 HTML-discovered cardshop URLs:", discoveredFromHtml.slice(0, 6));
        console.log("🔎 HTML-discovered content IDs:", ids.slice(0, 6));
      } else {
        console.log("🔎 No cardshop URLs/IDs found in HTML.");
      }
    }

    for (const apiUrl of allCandidates) {
      try {
        console.log("🔗 Trying Amex cardshop API:", apiUrl);
        const headers: Record<string, string> = {
          Referer: url,
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          Origin: "https://www.americanexpress.com",
        };
        if (ua) headers["User-Agent"] = ua;

        const resp = await page.request.get(apiUrl, {
          headers,
          timeout: 15000,
        });
        if (resp.ok()) {
          liveJson = await resp.json();
          liveSource = apiUrl;
          console.log("✅ Amex cardshop API success:", apiUrl);
          break;
        }

        // Some endpoints require currentUrl for bot checks
        if (resp.status() === 417 && !apiUrl.includes("currentUrl=")) {
          const retryUrl = `${apiUrl}${apiUrl.includes("?") ? "&" : "?"}currentUrl=${encodeURIComponent(url)}`;
          console.log("🔁 Retrying with currentUrl:", retryUrl);
          const retry = await page.request.get(retryUrl, {
            headers,
            timeout: 15000,
          });
          if (retry.ok()) {
            liveJson = await retry.json();
            liveSource = retryUrl;
            console.log("✅ Amex cardshop API success:", retryUrl);
            break;
          }
          console.log(`↩️ Amex cardshop API ${retry.status()} at ${retryUrl}`);
        } else {
          console.log(`↩️ Amex cardshop API ${resp.status()} at ${apiUrl}`);
        }

        // Try browser fetch with credentials as a last resort for this URL
        try {
          const fetched = await page.evaluate(async (u) => {
            const r = await fetch(u, { credentials: "include" });
            if (!r.ok) return { ok: false, status: r.status };
            const data = await r.json().catch(() => null);
            return { ok: true, data };
          }, apiUrl);
          if (fetched?.ok && fetched.data) {
            liveJson = fetched.data;
            liveSource = apiUrl;
            console.log("✅ Amex API success via page fetch:", apiUrl);
            break;
          }
        } catch {}
      } catch (e) {
        console.log("⚠️ Amex API fetch error:", (e as Error).message);
      }
    }

    try {
      page.removeListener("response", cardshopListener);
    } catch {}

    if (sniffedApiUrls.size) {
      console.log("📡 Sniffed cardshop URLs:", Array.from(sniffedApiUrls).slice(0, 6));
    }

    if (process.env.AMEX_DUMP_HTML === "1" && html) {
      try {
        const fs = await import("node:fs");
        const safeSlug = slug.replace(/[^a-z0-9-]+/gi, "-");
        const outPath = `/tmp/amex-${safeSlug}.html`;
        fs.writeFileSync(outPath, html);
        console.log("📝 Saved Amex HTML to", outPath);
      } catch (e) {
        console.log("⚠️ Failed to write HTML dump:", (e as Error).message);
      }
    }

    // Fallback: older app base APIs if cardshop fails
    if (!liveJson) {
      const bases = await discoverAmexAppBases(page);
      console.log("🔎 Discovered Amex app bases:", bases);
      const candidates = buildCandidateApiUrls(bases, slug);
      for (const apiUrl of candidates) {
        try {
          console.log("🔗 Trying legacy Amex API:", apiUrl);
          const resp = await page.request.get(apiUrl, {
            headers: { Referer: url, Accept: "application/json" },
            timeout: 15000,
          });
          if (resp.ok()) {
            liveJson = await resp.json();
            liveSource = apiUrl;
            console.log("✅ Legacy Amex API success:", apiUrl);
            break;
          } else {
            console.log(`↩️ Legacy Amex API ${resp.status()} at ${apiUrl}`);
          }
        } catch (e) {
          console.log("⚠️ Legacy Amex API fetch error:", (e as Error).message);
        }
      }
    }

    // Build a single big text pool to parse regardless of source
    let textPool = "";
    let name: string | undefined;
    let cardData: any | null = null;

    if (liveJson) {
      cardData = pickCardData(liveJson);
      const details = cardData || liveJson?.details || liveJson?.pageData || liveJson;
      textPool += JSON.stringify(details);
      name =
        cardData?.cardTitle?.text ||
        cardData?.cardTitle ||
        cardData?.productName ||
        liveJson?.productName ||
        liveJson?.seo?.title ||
        liveJson?.title ||
        undefined;
      if (liveSource) {
        textPool += ` ${liveSource}`;
      }
    }

    // Last-resort: page text (may be sparse on Amex)
    if (!textPool) {
      if (metaText) textPool += `${metaText} `;
      if (stateSnippet) textPool += `${stateSnippet} `;
      const bodyText = await page.locator("body").innerText().catch(() => "");
      textPool += bodyText || "";
    }

    if (!name && metaTitle && !isBadMetaTitle(metaTitle)) {
      name = metaTitle.replace(/\s+\|\s+American Express.*$/i, "").trim();
    }
    if (!name || isBadMetaTitle(name)) {
      const cleanedSlug = slug
        .replace(/-credit-card-amex$/i, "")
        .replace(/-credit-card$/i, "")
        .replace(/-card$/i, "")
        .replace(/-amex$/i, "");
      const titled = cleanedSlug
        .split("-")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      name = `American Express ${titled}`.trim();
    }

    // Basic field extraction
    if (!name) {
      const nMatch = textPool.match(/(American Express.*?(Gold|Blue|Platinum|Cash|Everyday).*?Card)/i);
      name = nMatch ? nMatch[1].trim() : `American Express ${slug.replace(/-/g, " ")}`;
    }

    const annualFee = extractAnnualFeeFromText(textPool);
    let rewardsByCategory = extractRewardsFromText(textPool);
    if ((!rewardsByCategory || Object.keys(rewardsByCategory).length === 0) && metaDescription) {
      rewardsByCategory = parseRewardsFromMetaDescription(metaDescription);
    }
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
