type EnrollmentLinkInput = {
  cardName?: string;
  issuer?: string;
  label?: string;
  partner?: string;
  enrollmentUrl?: string;
  creditSourceUrl?: string;
  cardSourceUrl?: string;
};

export type EnrollmentLink = {
  url: string;
  ctaLabel: string;
};

const ISSUER_FALLBACKS: Record<string, string> = {
  "american express": "https://www.americanexpress.com/en-us/benefits/",
  chase: "https://creditcards.chase.com/",
  citi: "https://www.citi.com/credit-cards",
  "capital one": "https://www.capitalone.com/credit-cards/",
  "bank of america": "https://www.bankofamerica.com/credit-cards/",
  "u.s. bank": "https://www.usbank.com/credit-cards.html",
  discover: "https://www.discover.com/credit-cards/",
};

const AMEX_CARD_BENEFIT_PAGES: Array<{ pattern: RegExp; url: string }> = [
  {
    pattern: /platinum/i,
    url: "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
  },
  {
    pattern: /gold/i,
    url: "https://www.americanexpress.com/en-us/benefits/the-gold-card/",
  },
];

function resolveAmexBenefitPage(cardName?: string): string | null {
  const name = String(cardName || "");
  for (const candidate of AMEX_CARD_BENEFIT_PAGES) {
    if (candidate.pattern.test(name)) return candidate.url;
  }
  return null;
}

export function getEnrollmentLink(
  input: EnrollmentLinkInput,
): EnrollmentLink | null {
  const issuerKey = String(input.issuer || "")
    .toLowerCase()
    .trim();

  if (input.enrollmentUrl)
    return { url: input.enrollmentUrl, ctaLabel: "Enroll" };

  if (issuerKey === "american express") {
    const amexBenefitPage = resolveAmexBenefitPage(input.cardName);
    if (amexBenefitPage)
      return { url: amexBenefitPage, ctaLabel: "Open benefit page" };
    if (input.creditSourceUrl)
      return { url: input.creditSourceUrl, ctaLabel: "Open benefit page" };
    if (input.cardSourceUrl)
      return { url: input.cardSourceUrl, ctaLabel: "View card details" };
    if (ISSUER_FALLBACKS[issuerKey])
      return {
        url: ISSUER_FALLBACKS[issuerKey],
        ctaLabel: "Open benefits hub",
      };
    return null;
  }

  if (input.creditSourceUrl)
    return { url: input.creditSourceUrl, ctaLabel: "Open benefit page" };
  if (input.cardSourceUrl)
    return { url: input.cardSourceUrl, ctaLabel: "View card details" };
  if (ISSUER_FALLBACKS[issuerKey])
    return { url: ISSUER_FALLBACKS[issuerKey], ctaLabel: "Open issuer page" };
  return null;
}
