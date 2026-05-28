import { getCardsCollection } from "./db";
import { CARD_OVERRIDES } from "./scrapers/overrides/cards";
import { isLikelyJunkBenefitText } from "./scrapers/benefitsQuality";

type CreditDoc = { label?: string; name?: string; period?: string; amountUSD?: number };

export type CardDoc = {
  slug?: string;
  name?: string;
  issuer?: string;
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

type BenefitHit = {
  benefit: string;
  normalized: string;
  card: string;
  slug: string;
  issuer: string;
  type: "perk" | "credit";
};

export type AuditSummaryEntry = {
  normalized: string;
  example: string;
  count: number;
  issuers: string[];
  cards: string[];
  slugs: string[];
  types: Array<"perk" | "credit">;
  suspicionScore: number;
  reasons: string[];
};

export type CardIssue = {
  slug: string;
  card: string;
  issuer: string;
  reasons: string[];
};

export type BenefitsAuditReport = {
  totalCards: number;
  uniqueBenefits: number;
  crossIssuerCount: number;
  widespreadCount: number;
  suspiciousBenefits: AuditSummaryEntry[];
  topBenefits: AuditSummaryEntry[];
  cardIssues: CardIssue[];
};

const EXPECTED_SHARED_BENEFIT_PATTERNS: RegExp[] = [
  /^no annual fee$/,
  /^no foreign transaction fees?$/,
  /^1 ?x points on all other purchases$/,
  /^1 ?% cash back on all other purchases$/,
  /^unlimited 1\.?5 ?% cash back on (every purchase|all purchases)$/,
  /^1\.?5 ?% cash back on all purchases$/,
];

function isExpectedSharedBenefit(value: string) {
  const normalized = String(value || "").toLowerCase().trim();
  return EXPECTED_SHARED_BENEFIT_PATTERNS.some((rx) => rx.test(normalized));
}

function normalizeBenefit(value: string) {
  let s = String(value || "").toLowerCase().trim();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\$?\d+(?:\.\d+)?/g, "");
  s = s.replace(/\b(per month|per year|per quarter|monthly|annual|year|quarter|semi-annual|up to)\b/g, "");
  s = s.replace(/[®™]/g, "");
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function mergeCard(card: CardDoc): CardDoc {
  const override = card?.slug ? CARD_OVERRIDES[card.slug] : undefined;
  if (!override) return card;
  return {
    ...card,
    name: override.name ?? card.name,
    issuer: override.issuer ?? card.issuer,
    perks: override.perks ?? card.perks,
    merchantCredits: override.merchantCredits ?? card.merchantCredits,
    recurringCredits: override.recurringCredits ?? card.recurringCredits,
  };
}

function scoreBenefit(list: BenefitHit[]) {
  const reasons: string[] = [];
  const issuers = Array.from(new Set(list.map((l) => l.issuer)));
  const cards = Array.from(new Set(list.map((l) => l.card)));
  const types = Array.from(new Set(list.map((l) => l.type)));
  const example = list[0]?.benefit || "";
  let suspicionScore = 0;

  if (isExpectedSharedBenefit(example)) {
    return { suspicionScore: 0, reasons };
  }

  if (issuers.length > 1) {
    suspicionScore += 3;
    reasons.push("appears across multiple issuers");
  }
  if (cards.length >= 6) {
    suspicionScore += 2;
    reasons.push("appears on many cards");
  }
  if (types.length > 1) {
    suspicionScore += 1;
    reasons.push("appears as both perk and credit");
  }
  if (isLikelyJunkBenefitText(example)) {
    suspicionScore += 5;
    reasons.push("matches junk-text pattern");
  }
  if (example.length < 8) {
    suspicionScore += 1;
    reasons.push("very short label");
  }

  return { suspicionScore, reasons };
}

function collectCardIssues(card: CardDoc): CardIssue | null {
  const slug = card.slug || "unknown";
  const name = card.name || slug;
  const issuer = card.issuer || "Unknown issuer";
  const reasons: string[] = [];
  const perks = Array.isArray(card.perks) ? card.perks.map((p) => String(p || "").trim()).filter(Boolean) : [];
  const creditLabels = [
    ...(Array.isArray(card.merchantCredits) ? card.merchantCredits : []),
    ...(Array.isArray(card.recurringCredits) ? card.recurringCredits : []),
  ].map((c) => String(c.label || c.name || "").trim()).filter(Boolean);

  if (card.reviewStatus === "needs_review") reasons.push("reviewStatus=needs_review");
  if (card.scrapeQa?.needsReview) reasons.push("scrapeQa.needsReview=true");
  if (Number(card.scrapeQa?.junkCount || 0) > 0) reasons.push(`scrapeQa.junkCount=${card.scrapeQa?.junkCount}`);
  if (perks.some((perk) => isLikelyJunkBenefitText(perk))) reasons.push("contains junk perk text");
  if (creditLabels.some((label) => isLikelyJunkBenefitText(label))) reasons.push("contains junk credit text");

  return reasons.length ? { slug, card: name, issuer, reasons } : null;
}

export function buildBenefitsAudit(cardsInput: CardDoc[]): BenefitsAuditReport {
  const cards = cardsInput.map(mergeCard);
  const hits: BenefitHit[] = [];
  const cardIssues = cards.map(collectCardIssues).filter(Boolean) as CardIssue[];

  for (const card of cards) {
    const cardName = card.name || card.slug || "Unknown";
    const slug = card.slug || "unknown";
    const issuer = card.issuer || "Unknown issuer";

    for (const perk of card.perks || []) {
      const normalized = normalizeBenefit(perk);
      if (!normalized) continue;
      hits.push({ benefit: perk, normalized, card: cardName, slug, issuer, type: "perk" });
    }

    const credits = [
      ...(Array.isArray(card.merchantCredits) ? card.merchantCredits : []),
      ...(Array.isArray(card.recurringCredits) ? card.recurringCredits : []),
    ];

    for (const credit of credits) {
      const label = credit.label || credit.name || "";
      const normalized = normalizeBenefit(label);
      if (!normalized) continue;
      hits.push({ benefit: label, normalized, card: cardName, slug, issuer, type: "credit" });
    }
  }

  const grouped = new Map<string, BenefitHit[]>();
  for (const hit of hits) {
    const list = grouped.get(hit.normalized) || [];
    list.push(hit);
    grouped.set(hit.normalized, list);
  }

  const summary: AuditSummaryEntry[] = Array.from(grouped.entries()).map(([normalized, list]) => {
    const issuers = Array.from(new Set(list.map((l) => l.issuer)));
    const cards = Array.from(new Set(list.map((l) => l.card)));
    const slugs = Array.from(new Set(list.map((l) => l.slug)));
    const types = Array.from(new Set(list.map((l) => l.type))) as Array<"perk" | "credit">;
    const { suspicionScore, reasons } = scoreBenefit(list);
    return {
      normalized,
      example: list[0]?.benefit || normalized,
      count: cards.length,
      issuers,
      cards: cards.slice(0, 12),
      slugs: slugs.slice(0, 12),
      types,
      suspicionScore,
      reasons,
    };
  });

  const suspiciousBenefits = [...summary]
    .filter((s) => s.suspicionScore > 0)
    .sort((a, b) => b.suspicionScore - a.suspicionScore || b.count - a.count);

  const topBenefits = [...summary].sort((a, b) => b.count - a.count).slice(0, 20);
  const crossIssuerCount = summary.filter((s) => s.issuers.length > 1).length;
  const widespreadCount = summary.filter((s) => s.count >= 6).length;

  return {
    totalCards: cards.length,
    uniqueBenefits: summary.length,
    crossIssuerCount,
    widespreadCount,
    suspiciousBenefits: suspiciousBenefits.slice(0, 25),
    topBenefits,
    cardIssues: cardIssues.slice(0, 25),
  };
}

export async function main() {
  const col = await getCardsCollection();
  const rawCards = (await col.find({}).toArray()) as CardDoc[];
  const report = buildBenefitsAudit(rawCards);

  console.log("=== Benefits Audit ===");
  console.log("Total cards:", report.totalCards);
  console.log("Unique benefits:", report.uniqueBenefits);
  console.log("Cross-issuer benefits:", report.crossIssuerCount);
  console.log("Benefits on 6+ cards:", report.widespreadCount);
  console.log("Cards with explicit QA issues:", report.cardIssues.length);

  console.log("\n--- Top 20 most common benefits ---");
  report.topBenefits.forEach((entry) => {
    console.log(`• (${entry.count}) ${entry.example}`);
    console.log(`  Issuers: ${entry.issuers.join(", ")}`);
    console.log(`  Cards: ${entry.cards.join(" | ")}`);
  });

  console.log("\n--- Suspicious benefits ---");
  report.suspiciousBenefits.forEach((entry) => {
    console.log(`• [score=${entry.suspicionScore}] (${entry.count}) ${entry.example}`);
    console.log(`  Reasons: ${entry.reasons.join("; ")}`);
    console.log(`  Issuers: ${entry.issuers.join(", ")}`);
    console.log(`  Cards: ${entry.cards.join(" | ")}`);
  });

  if (report.cardIssues.length) {
    console.log("\n--- Cards with explicit QA issues ---");
    report.cardIssues.forEach((issue) => {
      console.log(`• ${issue.slug} (${issue.issuer})`);
      console.log(`  Reasons: ${issue.reasons.join("; ")}`);
    });
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
