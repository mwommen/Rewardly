// backend/scrapers/adapters/index.ts
import type { ScrapeAdapter } from "./base";

import { amexApiAdapter } from "./amexApiAdapter";
import { amexAdapter } from "./amex";
import { chaseApiAdapter } from "./chaseApiAdapter";
import { chaseAdapter } from "./chase";

import { citiAdapter } from "./citi";
import { discoverAdapter } from "./discover";
import { capitalOneAdapter } from "./capitalone";
import { boaAdapter } from "./boa";
import { usbankAdapter } from "./usbank";

export const allAdapters: ScrapeAdapter[] = [
  // Preferred API/fast adapters first
  amexApiAdapter,
  chaseApiAdapter,

  // Text/DOM fallbacks
  amexAdapter,
  chaseAdapter,

  // Newly added
  citiAdapter,
  discoverAdapter,
  capitalOneAdapter,
  boaAdapter,
  usbankAdapter,
];

export function getAdapterForUrl(url: string): ScrapeAdapter | null {
  const adapter = allAdapters.find((a) => a.matches(url));
  if (!adapter) {
    console.warn(`⚠️ No matching adapter found for URL: ${url}`);
    return null;
  }
  console.log(`🔍 Using adapter: ${adapter.id}`);
  return adapter;
}
