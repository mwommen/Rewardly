const BENEFIT_TERMS = [
  "cell phone insurance",
  "cell phone protection",
  "rental car insurance",
  "rental car coverage",
  "lounge access",
  "airport lounge",
  "tsa precheck",
  "uber credit",
  "dining credit",
  "purchase protection",
  "extended warranty",
  "return protection",
  "trip delay insurance",
  "travel protection",
];

const KNOWN_MERCHANTS = [
  "lululemon",
  "capital one travel",
  "doordash",
  "saks",
  "saks fifth avenue",
  "uber",
  "lyft",
  "amazon",
  "starbucks",
  "walmart",
  "target",
  "cvs",
  "walgreens",
];

const KNOWN_CATEGORIES = [
  "travel",
  "dining",
  "groceries",
  "gas",
  "streaming",
  "drugstores",
  "apparel",
  "cell phone insurance",
  "cell phone protection",
  "rental car insurance",
  "rental car coverage",
  "purchase protection",
  "extended warranty",
  "return protection",
  "tsa precheck",
  "airport lounge",
  "lounge access",
  "dining credit",
  "uber credit",
  "trip delay insurance",
];

export function parseIntent(input: string) {
  const cleaned = input.trim();
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  const merchant = KNOWN_MERCHANTS.find((candidate) => lower.includes(candidate));
  if (merchant) return merchant;

  const category = KNOWN_CATEGORIES.find((candidate) => lower.includes(candidate));
  if (category) return category;

  return cleaned
    .replace(/^(i am|i'm|im|buying|ordering|booking|paying for|shopping at|using)\s+/i, "")
    .replace(/\s+(checkout|purchase|order|payment)$/i, "")
    .trim();
}

export function isBenefitIntent(input: string) {
  const lower = input.toLowerCase();
  return BENEFIT_TERMS.some((term) => lower.includes(term));
}
