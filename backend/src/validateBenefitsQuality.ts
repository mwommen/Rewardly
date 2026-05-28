import { getCardsCollection } from "./db";
import { isLikelyJunkBenefitText } from "./scrapers/benefitsQuality";
import type { Period } from "./models/benefits";

type CreditDoc = {
  label?: string;
  name?: string;
  amountUSD?: number;
  period?: string;
};

export type CardDoc = {
  slug?: string;
  name?: string;
  perks?: string[];
  merchantCredits?: CreditDoc[];
  recurringCredits?: CreditDoc[];
  reviewStatus?: string;
  scrapeQa?: {
    needsReview?: boolean;
    junkCount?: number;
    junkRatio?: number;
  };
};

export type ValidationFailure = {
  slug: string;
  reason: string;
};

const VALID_PERIODS = new Set<Period>(["month", "quarter", "semi-annual", "year"]);

function normalizeLine(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/([a-z])(?:sm|tm|rm)\b/g, "$1")
    .replace(/\b(sm|tm|rm)\b/g, "")
    .replace(/\$\d+(?:\.\d+)?/g, "$")
    .replace(/[^a-z0-9$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDuplicateCount(values: string[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const value of values) {
    const normalized = normalizeLine(value);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicates += 1;
      continue;
    }
    seen.add(normalized);
  }
  return duplicates;
}

function isSuspiciouslyShort(value: string) {
  const s = String(value || "").trim();
  return !!s && s.length < 6;
}

function isSuspiciouslyLong(value: string) {
  return String(value || "").trim().length > 240;
}

function getCreditLabel(credit: CreditDoc) {
  return String(credit.label || credit.name || "").trim();
}

function validateCredit(credit: CreditDoc): string | null {
  const label = getCreditLabel(credit);
  if (!label) return "credit missing label";
  if (isLikelyJunkBenefitText(label)) return "credit label looks like junk";
  if (isSuspiciouslyShort(label)) return "credit label too short";
  if (isSuspiciouslyLong(label)) return "credit label too long";
  if (!Number.isFinite(credit.amountUSD)) return "credit missing amount";
  if (Number(credit.amountUSD) <= 0) return "credit amount must be positive";
  if (!credit.period || !VALID_PERIODS.has(credit.period as Period)) return "credit period invalid";
  return null;
}

export function validateBenefitsQuality(cards: CardDoc[]): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  for (const card of cards) {
    const slug = card.slug || "unknown";
    const perks = Array.isArray(card.perks) ? card.perks.map((p) => String(p || "").trim()).filter(Boolean) : [];
    const merchantCredits = Array.isArray(card.merchantCredits) ? card.merchantCredits : [];
    const recurringCredits = Array.isArray(card.recurringCredits) ? card.recurringCredits : [];

    if (card.reviewStatus === "needs_review") {
      failures.push({ slug, reason: "marked needs_review" });
    }

    if (card.scrapeQa?.needsReview) {
      failures.push({ slug, reason: "scrapeQa flagged needsReview" });
    }

    if (Number(card.scrapeQa?.junkCount || 0) > 0) {
      failures.push({ slug, reason: `scrapeQa junkCount=${card.scrapeQa?.junkCount}` });
    }

    if (typeof card.scrapeQa?.junkRatio === "number" && card.scrapeQa.junkRatio >= 0.2) {
      failures.push({ slug, reason: `scrapeQa junkRatio=${card.scrapeQa.junkRatio.toFixed(2)}` });
    }

    const junkPerks = perks.filter((p) => isLikelyJunkBenefitText(p));
    if (junkPerks.length) {
      failures.push({ slug, reason: `${junkPerks.length} junk perk lines` });
    }

    const shortPerks = perks.filter((p) => isSuspiciouslyShort(p));
    if (shortPerks.length) {
      failures.push({ slug, reason: `${shortPerks.length} perks too short` });
    }

    const longPerks = perks.filter((p) => isSuspiciouslyLong(p));
    if (longPerks.length) {
      failures.push({ slug, reason: `${longPerks.length} perks too long` });
    }

    const perkDuplicates = getDuplicateCount(perks);
    if (perkDuplicates > 0) {
      failures.push({ slug, reason: `${perkDuplicates} duplicate perk lines` });
    }

    const creditLabels = [...merchantCredits, ...recurringCredits].map(getCreditLabel).filter(Boolean);
    const junkCredits = creditLabels.filter((label) => isLikelyJunkBenefitText(label));
    if (junkCredits.length) {
      failures.push({ slug, reason: `${junkCredits.length} junk credit lines` });
    }

    const creditDuplicates = getDuplicateCount(creditLabels);
    if (creditDuplicates > 0) {
      failures.push({ slug, reason: `${creditDuplicates} duplicate credit lines` });
    }

    for (const credit of merchantCredits) {
      const issue = validateCredit(credit);
      if (issue) failures.push({ slug, reason: `merchant credit: ${issue}` });
    }

    for (const credit of recurringCredits) {
      const issue = validateCredit(credit);
      if (issue) failures.push({ slug, reason: `recurring credit: ${issue}` });
    }
  }

  return failures;
}

export async function main() {
  const col = await getCardsCollection();
  const cards = (await col.find({}).toArray()) as CardDoc[];
  const failures = validateBenefitsQuality(cards);

  if (failures.length) {
    console.error("Benefits quality validation failed:");
    failures.slice(0, 100).forEach((failure) => console.error(`- ${failure.slug}: ${failure.reason}`));
    process.exit(1);
  }

  console.log(`Benefits quality validation passed (${cards.length} cards)`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Validation error:", err);
    process.exit(2);
  });
}
