type CardMeta = { slug?: string; name?: string };

const logoPath = (path: string) => encodeURI(path);

const CARD_LOGOS: Record<string, string> = {
  "amex-gold": logoPath("/card-logos/amex-gold.png"),
  "amex-platinum": logoPath("/card-logos/amex-platinum.png"),
  "amex-everyday-preferred": logoPath(
    "/card-logos/Amex EveryDay\u00ae Preferred Credit Card.png",
  ),
  "amex-green": logoPath("/card-logos/Amex Express Green.png"),
  "amex-blue-business-plus": logoPath(
    "/card-logos/Amex Blue Business Plus.png",
  ),
  "chase-sapphire-preferred": logoPath(
    "/card-logos/chase-sapphire-preferred.png",
  ),
  "chase-freedom-unlimited": logoPath(
    "/card-logos/chase-freedom-unlimited.png",
  ),
  "chase-ink-business-unlimited": logoPath(
    "/card-logos/Ink Business Unlimited Chase .png",
  ),
  "chase-freedom-flex": logoPath("/card-logos/Chase Freedom Flex.png"),
  "chase-sapphire-reserve": logoPath("/card-logos/Chase Sapphire Reserve.png"),
  "chase-ink-business-cash": logoPath(
    "/card-logos/Ink Business Cash\u00ae Credit Card.png",
  ),
  "citi-custom-cash": logoPath("/card-logos/citi-custom-cash.png"),
  "capital-one-savorone": logoPath("/card-logos/capital-one-savorone.png"),
  "capital-one-venture-x": logoPath("/card-logos/capital-one-venture-x.png"),
  "capital-one-venture-rewards": logoPath(
    "/card-logos/Capital One Venture Rewards.png",
  ),
  "boa-customized-cash-rewards": logoPath(
    "/card-logos/Bank Of America Customized Cash Rewards.png",
  ),
  "boa-unlimited-cash-rewards": logoPath(
    "/card-logos/Bank of America Unlimited Cash Rewards.png",
  ),
  "boa-travel-rewards": logoPath(
    "/card-logos/Bank of America\u00ae Travel Rewards.png",
  ),
  "usbank-cash-plus": logoPath(
    "/card-logos/U.S. Bank Cash+\u00ae Visa Signature\u00ae Card.png",
  ),
  "usbank-smartly": logoPath(
    "/card-logos/U.S. Bank Smartly\u2122 Visa Signature\u00ae Card.png",
  ),
  "usbank-shield": logoPath(
    "/card-logos/U.S. Bank Shield\u2122 Visa\u00ae Card.png",
  ),
  "usbank-altitude-go": logoPath(
    "/card-logos/U.S. Bank Altitude\u00ae Go Visa Signature\u00ae Card.png",
  ),
  "usbank-split": logoPath(
    "/card-logos/Split\u2122 World Mastercard\u00ae.png",
  ),
  "amex-everyday": logoPath("/card-logos/merican Express amex everyday.png"),
};

const NAME_FALLBACKS: Array<[RegExp, string]> = [
  [/amex.*gold/i, "amex-gold"],
  [
    /amex.*everyday(?!.*preferred)|american express.*everyday(?!.*preferred)/i,
    "amex-everyday",
  ],
  [/everyday.*preferred/i, "amex-everyday-preferred"],
  [/blue business plus/i, "amex-blue-business-plus"],
  [/amex.*green|american express.*green/i, "amex-green"],
  [/platinum.*american express|american express.*platinum/i, "amex-platinum"],
  [/sapphire preferred/i, "chase-sapphire-preferred"],
  [/sapphire reserve/i, "chase-sapphire-reserve"],
  [/freedom unlimited/i, "chase-freedom-unlimited"],
  [/freedom flex/i, "chase-freedom-flex"],
  [/ink business cash/i, "chase-ink-business-cash"],
  [/ink business unlimited/i, "chase-ink-business-unlimited"],
  [/custom cash/i, "citi-custom-cash"],
  [/savorone/i, "capital-one-savorone"],
  [/venture rewards/i, "capital-one-venture-rewards"],
  [/venture x/i, "capital-one-venture-x"],
  [/customized cash rewards/i, "boa-customized-cash-rewards"],
  [/unlimited cash rewards/i, "boa-unlimited-cash-rewards"],
  [/travel rewards/i, "boa-travel-rewards"],
  [/cash\+\s*.*visa signature/i, "usbank-cash-plus"],
  [/smartly/i, "usbank-smartly"],
  [/shield/i, "usbank-shield"],
  [/altitude go/i, "usbank-altitude-go"],
  [/split.*world mastercard/i, "usbank-split"],
];

export function getCardLogo(card?: CardMeta): string | null {
  const slug = String(card?.slug || "")
    .trim()
    .toLowerCase();
  if (slug && CARD_LOGOS[slug]) return CARD_LOGOS[slug];
  const name = card?.name || "";
  for (const [pattern, key] of NAME_FALLBACKS) {
    if (pattern.test(name)) return CARD_LOGOS[key] || null;
  }
  return null;
}

export function getCardLogoBySlug(slug?: string): string | null {
  if (!slug) return null;
  return CARD_LOGOS[String(slug).trim().toLowerCase()] || null;
}
