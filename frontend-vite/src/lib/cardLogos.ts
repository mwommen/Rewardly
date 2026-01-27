type CardMeta = { slug?: string; name?: string };

const CARD_LOGOS: Record<string, string> = {
  "amex-gold": "/card-logos/amex-gold.png",
  "amex-platinum": "/card-logos/amex-platinum.png",
  "chase-sapphire-preferred": "/card-logos/chase-sapphire-preferred.png",
  "chase-freedom-unlimited": "/card-logos/chase-freedom-unlimited.png",
  "citi-custom-cash": "/card-logos/citi-custom-cash.png",
  "capital-one-savorone": "/card-logos/capital-one-savorone.png",
  "capital-one-venture-x": "/card-logos/capital-one-venture-x.png",
};

const NAME_FALLBACKS: Array<[RegExp, string]> = [
  [/amex.*gold/i, "amex-gold"],
  [/platinum.*american express|american express.*platinum/i, "amex-platinum"],
  [/sapphire preferred/i, "chase-sapphire-preferred"],
  [/freedom unlimited/i, "chase-freedom-unlimited"],
  [/custom cash/i, "citi-custom-cash"],
  [/savorone/i, "capital-one-savorone"],
  [/venture x/i, "capital-one-venture-x"],
];

export function getCardLogo(card?: CardMeta): string | null {
  const slug = card?.slug || "";
  if (slug && CARD_LOGOS[slug]) return CARD_LOGOS[slug];
  const name = card?.name || "";
  for (const [pattern, key] of NAME_FALLBACKS) {
    if (pattern.test(name)) return CARD_LOGOS[key] || null;
  }
  return null;
}

export function getCardLogoBySlug(slug?: string): string | null {
  if (!slug) return null;
  return CARD_LOGOS[slug] || null;
}
