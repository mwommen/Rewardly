// src/scrapers/parsers/index.ts
import type { BenefitsPayload } from "../../models/benefits";
export type { BenefitsPayload, Period, RewardsArrayEntry } from "../../models/benefits";

export type CardParser = {
  // ✅ SYNC parser
  parse: (text: string, url?: string) => BenefitsPayload;
};

import { parseGeneric } from "./genericParser";
import { parseAmex } from "./issuers/amexParser";
import { parseChase } from "./issuers/chaseParser";
import { parseCiti } from "./issuers/citiParser";
import { parseDiscover } from "./issuers/discoverParser";
import { parseCapitalOne } from "./issuers/capitaloneParser";

// ✅ Return a SYNC function (not a Promise)
export function pickParser(url: string): (text: string, url?: string) => BenefitsPayload {
  const u = (url || "").toLowerCase();
  if (u.includes("americanexpress.")) {
    return parseAmex;
  }
  if (u.includes("chase.")) {
    return parseChase;
  }
  if (u.includes("citi.")) {
    return parseCiti;
  }
  if (u.includes("discover.")) {
    return parseDiscover;
  }
  if (u.includes("capitalone.")) {
    return parseCapitalOne;
  }
  return parseGeneric;
}
