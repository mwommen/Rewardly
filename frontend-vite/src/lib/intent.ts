export type BenefitIntentMatch = {
  key: string;
  label: string;
  aliases: string[];
};

export const BENEFIT_INTENTS: BenefitIntentMatch[] = [
  {
    key: "cell-phone-protection",
    label: "Cell Phone Protection",
    aliases: [
      "cell phone insurance",
      "cell phone protection",
      "cellphone protection",
      "mobile phone insurance",
      "phone protection",
    ],
  },
  {
    key: "rental-car-insurance",
    label: "Rental Car Insurance",
    aliases: [
      "rental car insurance",
      "rental car coverage",
      "car rental insurance",
      "auto rental collision damage waiver",
      "car rental coverage",
      "rental collision",
    ],
  },
  {
    key: "purchase-protection",
    label: "Purchase Protection",
    aliases: [
      "purchase protection",
      "purchase security",
      "damage protection",
      "stolen item protection",
    ],
  },
  {
    key: "extended-warranty",
    label: "Extended Warranty",
    aliases: ["extended warranty", "warranty protection", "extra warranty"],
  },
  {
    key: "return-protection",
    label: "Return Protection",
    aliases: ["return protection", "returns protection"],
  },
  {
    key: "trip-delay",
    label: "Trip Delay",
    aliases: ["trip delay", "trip delay insurance", "flight delay"],
  },
  {
    key: "trip-cancellation",
    label: "Trip Cancellation",
    aliases: [
      "trip cancellation",
      "trip interruption",
      "trip cancellation insurance",
      "trip interruption insurance",
    ],
  },
  {
    key: "airport-lounge",
    label: "Airport Lounge Access",
    aliases: [
      "airport lounge",
      "lounge access",
      "priority pass",
      "centurion lounge",
      "delta sky club",
    ],
  },
  {
    key: "tsa-precheck",
    label: "TSA PreCheck",
    aliases: ["tsa precheck", "tsa pre check", "precheck"],
  },
  {
    key: "global-entry",
    label: "Global Entry",
    aliases: ["global entry"],
  },
  {
    key: "dining-credit",
    label: "Dining Credit",
    aliases: ["dining credit", "restaurant credit", "resy credit"],
  },
  {
    key: "uber-credit",
    label: "Uber Credit",
    aliases: ["uber credit", "uber cash", "uber benefit"],
  },
  {
    key: "streaming-credit",
    label: "Streaming Credit",
    aliases: [
      "streaming credit",
      "digital entertainment credit",
      "entertainment credit",
    ],
  },
  {
    key: "baggage-insurance",
    label: "Baggage Insurance",
    aliases: ["baggage insurance", "lost luggage", "bag insurance"],
  },
  {
    key: "travel-insurance",
    label: "Travel Insurance",
    aliases: [
      "travel insurance",
      "travel protection",
      "travel protections",
      "travel coverage",
    ],
  },
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
  "trip delay",
  "trip cancellation",
  "trip interruption",
  "priority pass",
  "global entry",
  "streaming credit",
  "digital entertainment credit",
  "baggage insurance",
  "travel insurance",
  "travel protection",
  "travel protections",
];

export function parseIntent(input: string) {
  const cleaned = input.trim();
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  const merchant = KNOWN_MERCHANTS.find((candidate) =>
    lower.includes(candidate),
  );
  if (merchant) return merchant;

  const category = KNOWN_CATEGORIES.find((candidate) =>
    lower.includes(candidate),
  );
  if (category) return category;

  return cleaned
    .replace(
      /^(i am|i'm|im|buying|ordering|booking|paying for|shopping at|using)\s+/i,
      "",
    )
    .replace(/\s+(checkout|purchase|order|payment)$/i, "")
    .trim();
}

export function isBenefitIntent(input: string) {
  return Boolean(detectBenefitIntent(input));
}

export function detectBenefitIntent(input: string) {
  const lower = input.toLowerCase();
  return (
    BENEFIT_INTENTS.find(
      (benefit) =>
        lower.includes(benefit.label.toLowerCase()) ||
        benefit.aliases.some((term) => lower.includes(term)),
    ) || null
  );
}
