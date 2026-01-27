// backend/src/services/benefitsQaService.ts
import { getCardsCollection } from "../db";
import { collectCreditMatches } from "../utils/merchantMatching";

type CreditMatch = {
  id?: string;
  label?: string;
  amountUSD?: number;
  period?: string;
  capPerPeriodUSD?: number;
  requiresEnrollment?: boolean;
  sourceUrl?: string;
  partner?: string;
  eligibleWhen?: { merchantPatterns?: string[] };
};

type CardMatch = {
  card: {
    slug?: string;
    name?: string;
    issuer?: string;
    sourceUrl?: string;
    lastScraped?: string;
  };
  credits: CreditMatch[];
};

export function findMerchantBenefitsInCards(cards: any[], merchant: string): CardMatch[] {
  const term = String(merchant || "").trim();
  if (!term) return [];

  return cards
    .map((card) => {
      const credits = collectCreditMatches(card, term) as CreditMatch[];
      if (!credits.length) return null;
      return {
        card: {
          slug: card.slug,
          name: card.name,
          issuer: card.issuer,
          sourceUrl: card.sourceUrl,
          lastScraped: card.lastScraped,
        },
        credits: credits.map((c) => ({
          id: c.id,
          label: c.label,
          amountUSD: c.amountUSD,
          period: c.period,
          capPerPeriodUSD: c.capPerPeriodUSD,
          requiresEnrollment: c.requiresEnrollment,
          sourceUrl: c.sourceUrl,
          partner: c.partner,
          eligibleWhen: c.eligibleWhen,
        })),
      };
    })
    .filter(Boolean) as CardMatch[];
}

export async function findMerchantBenefits(merchant: string): Promise<CardMatch[]> {
  const col = await getCardsCollection();
  const cards = await col.find({}).toArray();
  return findMerchantBenefitsInCards(cards, merchant);
}
