type ApplyCard = {
  slug?: string;
  name?: string;
  issuer?: string;
  sourceUrl?: string;
};

const APPLY_URLS: Record<string, string> = {
  "amex-gold":
    "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
  "amex-platinum":
    "https://www.americanexpress.com/us/credit-cards/card/platinum/",
  "amex-green-card":
    "https://www.americanexpress.com/us/credit-cards/card/green/",
  "amex-everyday":
    "https://www.americanexpress.com/us/credit-cards/card/amex-everyday/",
  "amex-everyday-preferred":
    "https://www.americanexpress.com/us/credit-cards/card/amex-everyday-preferred/",
  "blue-business-plus-credit-card-amex":
    "https://www.americanexpress.com/us/credit-cards/business/business-blueplus-credit-card/",
  "chase-sapphire-preferred":
    "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
  "chase-sapphire-reserve":
    "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
  "chase-freedom-unlimited":
    "https://creditcards.chase.com/cash-back-credit-cards/freedom/unlimited",
  "chase-freedom-flex":
    "https://creditcards.chase.com/cash-back-credit-cards/freedom/flex",
  "chase-ink-cash":
    "https://creditcards.chase.com/business-credit-cards/ink/cash",
  "chase-ink-unlimited":
    "https://creditcards.chase.com/business-credit-cards/ink/unlimited",
  "chase-ink-preferred":
    "https://creditcards.chase.com/business-credit-cards/ink/business-preferred",
  "citi-custom-cash":
    "https://www.citi.com/credit-cards/citi-custom-cash-credit-card",
  "capital-one-savorone":
    "https://www.capitalone.com/credit-cards/savorone-dining-rewards/",
  "capital-one-savor":
    "https://www.capitalone.com/credit-cards/savor-dining-rewards/",
  "capital-one-venture-x": "https://www.capitalone.com/credit-cards/venture-x/",
  "capital-one-venture": "https://www.capitalone.com/credit-cards/venture/",
  "capital-one-ventureone":
    "https://www.capitalone.com/credit-cards/ventureone/",
  "capital-one-quicksilver":
    "https://www.capitalone.com/credit-cards/quicksilver/",
  "boa-customized-cash-rewards":
    "https://www.bankofamerica.com/credit-cards/products/cash-back-credit-card/",
  "boa-unlimited-cash-rewards":
    "https://www.bankofamerica.com/credit-cards/products/unlimited-cash-back-credit-card/",
  "boa-travel-rewards":
    "https://www.bankofamerica.com/credit-cards/products/travel-rewards-credit-card/",
  "usbank-cash-plus":
    "https://www.usbank.com/credit-cards/cash-plus-visa-signature-credit-card.html",
  "usbank-altitude-go":
    "https://www.usbank.com/credit-cards/altitude-go-visa-signature-credit-card.html",
  "usbank-smartly":
    "https://www.usbank.com/credit-cards/smartly-visa-signature-credit-card.html",
};

const NAME_FALLBACKS: Array<[RegExp, string]> = [
  [/gold.*american express|american express.*gold/i, "amex-gold"],
  [/platinum.*american express|american express.*platinum/i, "amex-platinum"],
  [/green.*american express|american express.*green/i, "amex-green-card"],
  [/blue business.*plus/i, "blue-business-plus-credit-card-amex"],
  [/sapphire preferred/i, "chase-sapphire-preferred"],
  [/sapphire reserve/i, "chase-sapphire-reserve"],
  [/freedom unlimited/i, "chase-freedom-unlimited"],
  [/freedom flex/i, "chase-freedom-flex"],
  [/custom cash/i, "citi-custom-cash"],
  [/savorone/i, "capital-one-savorone"],
  [/venture x/i, "capital-one-venture-x"],
  [/venture rewards/i, "capital-one-venture"],
  [/customized cash rewards/i, "boa-customized-cash-rewards"],
  [/unlimited cash rewards/i, "boa-unlimited-cash-rewards"],
  [/travel rewards/i, "boa-travel-rewards"],
  [/altitude go/i, "usbank-altitude-go"],
  [/cash\+/i, "usbank-cash-plus"],
];

const ISSUER_FALLBACKS: Record<string, string> = {
  "american express": "https://www.americanexpress.com/us/credit-cards/",
  chase: "https://creditcards.chase.com/",
  citi: "https://www.citi.com/credit-cards",
  "capital one": "https://www.capitalone.com/credit-cards/",
  "bank of america": "https://www.bankofamerica.com/credit-cards/",
  "u.s. bank": "https://www.usbank.com/credit-cards.html",
  discover: "https://www.discover.com/credit-cards/",
};

export function getApplyUrl(card?: ApplyCard | null): string | null {
  if (!card) return null;
  const slug = String(card.slug || "").trim();
  if (slug && APPLY_URLS[slug]) return APPLY_URLS[slug];
  if (card.sourceUrl) return card.sourceUrl;

  const name = String(card.name || "");
  for (const [pattern, key] of NAME_FALLBACKS) {
    if (pattern.test(name)) return APPLY_URLS[key] || null;
  }

  const issuer = String(card.issuer || "")
    .toLowerCase()
    .trim();
  return ISSUER_FALLBACKS[issuer] || null;
}
