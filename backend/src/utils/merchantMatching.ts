// backend/src/utils/merchantMatching.ts
export type MerchantCredit = {
  label?: string;
  eligibleWhen?: { merchantPatterns?: string[] };
  confidence?: number;
  sourceUrl?: string;
};

export type CardWithCredits = {
  merchantCredits?: MerchantCredit[];
  recurringCredits?: MerchantCredit[];
  sourceUrl?: string;
};

const MIN_MERCHANT_CREDIT_CONFIDENCE = 0.6;

function safeHost(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

export function matchesMerchant(
  credit: MerchantCredit,
  merchant: string,
  cardSourceHost?: string
): boolean {
  const m = (merchant || "").toLowerCase().trim();
  if (!m) return false;
  if (typeof credit?.confidence === "number" && credit.confidence < MIN_MERCHANT_CREDIT_CONFIDENCE) {
    return false;
  }
  const creditHost = safeHost(credit?.sourceUrl);
  if (cardSourceHost && creditHost && cardSourceHost !== creditHost) return false;
  const patterns = credit?.eligibleWhen?.merchantPatterns || [];
  if (patterns.some((p) => m.includes(String(p || "").toLowerCase()))) return true;
  const label = String(credit?.label || "").toLowerCase();
  return label.includes(m);
}

export function collectCreditMatches(card: CardWithCredits, merchant: string): MerchantCredit[] {
  const credits = [
    ...(Array.isArray(card?.merchantCredits) ? card.merchantCredits : []),
    ...(Array.isArray(card?.recurringCredits) ? card.recurringCredits : []),
  ];
  const cardSourceHost = safeHost(card?.sourceUrl);
  return credits.filter((c) => matchesMerchant(c, merchant, cardSourceHost));
}
