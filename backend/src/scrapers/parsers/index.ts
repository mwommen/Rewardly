// src/scrapers/parsers/index.ts

export type Period = "month" | "quarter" | "semi-annual" | "year";

export type RewardsArrayEntry = {
  keys: string[];
  rate: string;                          // e.g., "3%", "4x"
  unit: "cash" | "points" | "miles";
};

export type BenefitsPayload = {
  rewardsByCategory?: RewardsArrayEntry | RewardsArrayEntry[] | Record<string, string>;
  rewardsFlat?: { rate: number; unit: "cash" | "points" | "miles" }[];
  rewardsRotating?: {
    start?: string;
    end?: string;
    activationRequired?: boolean;
    categories: { keys: string[]; rate: string; unit: "cash" | "points" | "miles" }[];
  }[];
  merchantCredits?: {
    id: string;
    label: string;
    amountUSD: number;
    period: Period;
    capPerPeriodUSD: number;
    eligibleWhen?: { merchantPatterns?: string[]; mcc?: string[] };
    requiresEnrollment?: boolean;
    expiresAt?: string | null;
    sourceUrl?: string;
    confidence?: number;
  }[];
  recurringCredits?: {
    id: string;
    label: string;
    amountUSD: number;
    period: Period;
    partner?: string;
    requiresEnrollment?: boolean;
    sourceUrl?: string;
    confidence?: number;
  }[];
  perks?: string[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  signupOffer?: string | null;
  sourceUrl?: string;
  lastScraped?: string;
  confidence?: number;
};

export type CardParser = {
  parse: (text: string, url?: string) => BenefitsPayload;
};

import { parseGeneric } from "./genericParser";
import { parseAmex } from "./issuers/amexParser";

// Choose a parser by URL (add more issuers later)
export function pickParser(url: string): CardParser["parse"] {
  const u = (url || "").toLowerCase();
  if (u.includes("americanexpress.")) return parseAmex;
  return parseGeneric;
}
