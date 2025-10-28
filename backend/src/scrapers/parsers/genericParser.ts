// src/scrapers/parsers/genericParser.ts
import type { BenefitsPayload } from "./index";

export function parseGeneric(text: string, url?: string): BenefitsPayload {
  const perks: string[] = [];
  const recurringCredits: NonNullable<BenefitsPayload["recurringCredits"]> = [];

  const moneyRegex =
    /\$?\s?(\d{2,4})(?:\s?(?:annual|year|per year|monthly|per month|quarterly|per quarter))?/gi;

  for (const lineRaw of text.split(/\n+/)) {
    const line = lineRaw.trim();
    if (!line) continue;

    if (
      /warranty|protection|extended|no foreign|lounge|priority pass|insurance/i.test(line) &&
      line.length > 25
    ) {
      perks.push(line);
    }

    const m = [...line.matchAll(moneyRegex)][0];
    if (m && /credit|statement|reimbursement/i.test(line)) {
      const val = Number(m[1]);
      if (Number.isFinite(val) && val >= 10) {
        let period: any = "year";
        if (/per month|monthly/i.test(line)) period = "month";
        else if (/per quarter|quarterly/i.test(line)) period = "quarter";
        else if (/semi-annual|twice per year/i.test(line)) period = "semi-annual";

        recurringCredits.push({
          id: `generic-${val}-${period}-${recurringCredits.length + 1}`,
          label: line.slice(0, 160),
          amountUSD: val,
          period,
          requiresEnrollment: /enroll/i.test(line),
          sourceUrl: url,
          confidence: 0.45,
        });
      }
    }
  }

  return {
    perks: Array.from(new Set(perks)).slice(0, 30),
    recurringCredits,
    sourceUrl: url,
    confidence: 0.5,
  };
}
