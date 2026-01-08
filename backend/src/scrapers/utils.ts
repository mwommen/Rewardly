// backend/src/scrapers/utils.ts
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export type BenefitPattern = {
  id: string;                      // e.g., "amex-platinum-lululemon-credit"
  cardKeys?: string[];             // restrict to specific card keys (e.g., ["amex-platinum"])
  issuers?: string[];              // e.g., ["amex"]
  types: ("merchantCredit" | "recurringCredit" | "perk")[];
  merchant?: string;               // e.g., "Lululemon"
  label: string;                   // human label shown in UI/logs
  amount?: number;                 // credit amount if applicable
  cadence?: "monthly" | "quarterly" | "semiannual" | "annual" | "once";
  // How to detect on page:
  // At least one of: css selector text, regex, or mustInclude tokens must match
  selectors?: string[];            // CSS selectors; textContent will be scanned
  regexps?: string[];              // JS regex strings (with or without flags like (?i))
  mustInclude?: string[];          // all tokens must appear in page text (case-insensitive)
};

export type BenefitPatternsYaml = {
  issuers: {
    [issuer: string]: {
      patterns: BenefitPattern[];
    };
  };
};

export type MerchantCredit = {
  id: string;
  merchant: string;
  label: string;
  amount: number;
  cadence?: BenefitPattern["cadence"];
  source: "yaml";
};

export type RecurringCredit = {
  id: string;
  label: string;
  amount: number;
  cadence: NonNullable<BenefitPattern["cadence"]>;
  source: "yaml";
};

export type Perk = {
  id: string;
  label: string;
  source: "yaml";
};

export type ParsedBenefits = {
  merchantCredits: MerchantCredit[];
  recurringCredits: RecurringCredit[];
  perks: Perk[];
};

export function loadBenefitPatterns(): BenefitPatternsYaml {
  const file = path.resolve(
    __dirname,
    "./rules/benefit_patterns.yaml" // relative to src/scrapers
  );
  const raw = fs.readFileSync(file, "utf8");
  const data = yaml.load(raw) as BenefitPatternsYaml;
  if (!data || !data.issuers) {
    throw new Error("benefit_patterns.yaml is missing 'issuers' root.");
  }
  return data;
}

export function iNorm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function textIncludesAll(haystack: string, needles: string[]): boolean {
  const norm = iNorm(haystack);
  return needles.every((t) => norm.includes(iNorm(t)));
}

export function compileRegex(rx: string): RegExp {
  // Support inline (?i) for case-insensitive
  const hasInlineI = rx.startsWith("(?i)");
  const source = hasInlineI ? rx.replace("(?i)", "") : rx;
  return new RegExp(source, hasInlineI ? "i" : "i");
}

export function uniqueBy<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x.id)) {
      seen.add(x.id);
      out.push(x);
    }
  }
  return out;
}
