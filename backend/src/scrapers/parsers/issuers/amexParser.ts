// src/scrapers/parsers/issuers/amexParser.ts
import type { BenefitsPayload } from "../index";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

type Rules = {
  period_tokens?: Record<string, string>;
  merchant_aliases?: Record<string, string[]>;
  issuer_patterns?: {
    amex?: {
      recurring?: {
        match: string;
        label: string;
        amountUSD: number;
        period: string;
        partner?: string;
        requiresEnrollment?: boolean;
      }[];
      merchant_credits?: {
        match: string;
        label: string;
        amountUSD: number;
        period: string;
        merchantKey: string;
        requiresEnrollment?: boolean;
      }[];
    };
  };
};

let RULES: Rules = {};
(function loadRules() {
  try {
    const rulesPath = path.join(__dirname, "..", "..", "rules", "benefit_patterns.yaml"); // ../../rules/benefit_patterns.yaml
    const raw = fs.readFileSync(rulesPath, "utf8");
    RULES = yaml.load(raw) as Rules;
  } catch {
    RULES = {};
  }
})();

export function parseAmex(text: string, url?: string): BenefitsPayload {
  const out: BenefitsPayload = { sourceUrl: url, confidence: 0.7, perks: [] };

  // Recurring credits
  const rr: NonNullable<BenefitsPayload["recurringCredits"]> = [];
  for (const r of RULES.issuer_patterns?.amex?.recurring || []) {
    const re = new RegExp(r.match, "i");
    if (re.test(text)) {
      rr.push({
        id: `amex-recurring-${rr.length + 1}`,
        label: r.label,
        amountUSD: r.amountUSD,
        period: (r.period as any) || "year",
        partner: r.partner,
        requiresEnrollment: !!r.requiresEnrollment,
        sourceUrl: url,
        confidence: 0.9,
      });
    }
  }
  if (rr.length) out.recurringCredits = rr;

  // Merchant credits (e.g., Lululemon, Saks)
  const mc: NonNullable<BenefitsPayload["merchantCredits"]> = [];
  for (const r of RULES.issuer_patterns?.amex?.merchant_credits || []) {
    const re = new RegExp(r.match, "i");
    if (re.test(text)) {
      const patterns =
        RULES.merchant_aliases?.[r.merchantKey]?.length
          ? RULES.merchant_aliases![r.merchantKey]
          : [r.merchantKey];

      mc.push({
        id: `amex-merchant-${mc.length + 1}`,
        label: r.label,
        amountUSD: r.amountUSD,
        period: (r.period as any) || "year",
        capPerPeriodUSD: r.amountUSD,
        eligibleWhen: { merchantPatterns: patterns },
        requiresEnrollment: !!r.requiresEnrollment,
        sourceUrl: url,
        confidence: 0.92,
      });
    }
  }
  if (mc.length) out.merchantCredits = mc;

  // Simple category sniff
  const rewards: Record<string, string> = {};
  const RE = /(\d+)\s*(?:x|X|%)[^\n]{0,40}?\s(?:on|for|at)\s([a-zA-Z ]{3,40})/g;
  for (const m of text.matchAll(RE)) {
    const rate = m[1];
    const cat = (m[2] || "").toLowerCase().trim();
    const key =
      /flight|airline/.test(cat)
        ? "flights"
        : /hotel/.test(cat)
        ? "hotels"
        : /restaurant|dining/.test(cat)
        ? "dining"
        : /other/.test(cat)
        ? "other"
        : cat;
    rewards[key] = /\d+%/.test(m[0]) ? `${rate}%` : `${rate}x`;
  }
  if (Object.keys(rewards).length) out.rewardsByCategory = rewards;

  // Keep some perks
  out.perks = text
    .split(/\n|•|–|—|\./)
    .map((s) => s.trim())
    .filter((s) =>
      /lounge|CLEAR|Priority Pass|Global Entry|purchase protection|extended warranty|no foreign/i.test(
        s
      )
    )
    .slice(0, 30);

  return out;
}
