// src/scrapers/parsers/index.ts
import type { BenefitsPayload } from "../../models/benefits";
export type { BenefitsPayload, Period, RewardsArrayEntry } from "../../models/benefits";

export type CardParser = {
  // ✅ SYNC parser
  parse: (text: string, url?: string) => BenefitsPayload;
};

import { parseGeneric } from "./genericParser";
import { parseAmex } from "./issuers/amexParser";

// ✅ Return a SYNC function (not a Promise)
export function pickParser(url: string): (text: string, url?: string) => BenefitsPayload {
  const u = (url || "").toLowerCase();
  if (u.includes("americanexpress.")) {
    return parseAmex;
  }
  return parseGeneric;
}
