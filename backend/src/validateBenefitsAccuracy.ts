import { getCardsCollection } from "./db";

type CreditDoc = {
  label?: string;
  name?: string;
  amountUSD?: number;
  period?: string;
};

type CardDoc = {
  slug?: string;
  name?: string;
  issuer?: string;
  merchantCredits?: CreditDoc[];
  recurringCredits?: CreditDoc[];
  perks?: string[];
};

type ExpectedBenefit = {
  label: string;
  pattern: RegExp;
  expectedAmountUSD?: number;
  expectedPeriod?: string;
  acceptable?: Array<{ amountUSD: number; period: string }>;
};

type CardAccuracyFixture = {
  slug: string;
  cardName: string;
  sourceUrl: string;
  aliases?: string[];
  mustHave?: ExpectedBenefit[];
  mustNotHave?: RegExp[];
};

export type AccuracyFailure = {
  slug: string;
  severity: "error" | "warn";
  reason: string;
  sourceUrl?: string;
};

const FIXTURES: CardAccuracyFixture[] = [
  {
    slug: "amex-gold",
    cardName: "American Express Gold Card",
    sourceUrl: "https://www.americanexpress.com/en-us/account/get-started/gold/explore-benefits",
    aliases: ["american express gold"],
    mustHave: [
      {
        label: "$120 Dining Credit",
        pattern: /\$120.*dining credit|\$10.*dining credit/i,
        acceptable: [{ amountUSD: 120, period: "year" }, { amountUSD: 10, period: "month" }],
      },
      {
        label: "$100 Resy Credit",
        pattern: /\$100.*resy|\$50.*resy/i,
        acceptable: [{ amountUSD: 100, period: "year" }, { amountUSD: 50, period: "semi-annual" }],
      },
      {
        label: "$84 Dunkin' Credit",
        pattern: /\$84.*dunkin|\$7.*dunkin/i,
        acceptable: [{ amountUSD: 84, period: "year" }, { amountUSD: 7, period: "month" }],
      },
      {
        label: "$120 Uber Cash",
        pattern: /\$120.*uber cash|\$10.*uber cash/i,
        acceptable: [{ amountUSD: 120, period: "year" }, { amountUSD: 10, period: "month" }],
      },
    ],
    mustNotHave: [
      /\$75.*lululemon/i,
      /\$50.*saks/i,
      /\$209.*clear/i,
      /\$155.*walmart/i,
      /\$200.*airline fee/i,
      /\$600.*hotel/i,
      /\$300.*digital entertainment/i,
      /\$400.*resy/i,
      /\$200.*uber cash/i,
    ],
  },
  {
    slug: "amex-platinum",
    cardName: "The Platinum Card from American Express",
    sourceUrl: "https://www.americanexpress.com/en-us/account/get-started/platinum/benefits-overview",
    aliases: ["platinum card", "the platinum card"],
    mustHave: [
      { label: "$300 lululemon Credit", pattern: /\$75.*lululemon|\$300.*lululemon/i, expectedAmountUSD: 75, expectedPeriod: "quarter" },
      { label: "$100 Saks Credit", pattern: /\$50.*saks|\$100.*saks/i, expectedAmountUSD: 50, expectedPeriod: "semi-annual" },
      { label: "$200 Uber Cash", pattern: /\$200.*uber cash/i, expectedAmountUSD: 200, expectedPeriod: "year" },
      { label: "$120 Uber One Credit", pattern: /\$120.*uber one/i, expectedAmountUSD: 120, expectedPeriod: "year" },
      { label: "$209 CLEAR Plus Credit", pattern: /\$209.*clear/i, expectedAmountUSD: 209, expectedPeriod: "year" },
      { label: "$400 Resy Credit", pattern: /\$400.*resy/i, expectedAmountUSD: 400, expectedPeriod: "year" },
      { label: "$300 Digital Entertainment Credit", pattern: /\$300.*digital entertainment/i, expectedAmountUSD: 300, expectedPeriod: "year" },
      { label: "$155 Walmart+ Credit", pattern: /\$155.*walmart/i, expectedAmountUSD: 155, expectedPeriod: "year" },
      { label: "$200 Airline Fee Credit", pattern: /\$200.*airline fee/i, expectedAmountUSD: 200, expectedPeriod: "year" },
      { label: "$600 Hotel Credit", pattern: /\$600.*hotel/i, expectedAmountUSD: 600, expectedPeriod: "year" },
    ],
  },
  {
    slug: "capital-one-venture-x",
    cardName: "Capital One Venture X",
    sourceUrl: "https://www.capitalone.com/credit-cards/venture-x/",
    aliases: ["venture x", "capital one venture x"],
    mustHave: [
      { label: "$300 Capital One Travel credit", pattern: /\$300.*capital one travel/i, expectedAmountUSD: 300, expectedPeriod: "year" },
      { label: "Global Entry or TSA PreCheck credit", pattern: /global entry|tsa precheck/i, expectedAmountUSD: 100, expectedPeriod: "year" },
    ],
  },
];

const GLOBAL_FORBIDDEN_CREDIT_PATTERNS: RegExp[] = [
  /refer.*friend/i,
  /each friend who gets/i,
  /bonus points per year.*friend/i,
  /cash back per year.*friend/i,
  /click the button below/i,
];

function normalize(value: string) {
  return String(value || "")
    .replace(/[®™]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function creditLabel(credit: CreditDoc) {
  return normalize(credit.label || credit.name || "");
}

function allCredits(card: CardDoc) {
  return [
    ...(Array.isArray(card.merchantCredits) ? card.merchantCredits : []),
    ...(Array.isArray(card.recurringCredits) ? card.recurringCredits : []),
  ];
}

function cardMatchesFixture(card: CardDoc, fixture: CardAccuracyFixture) {
  const slug = String(card.slug || "").toLowerCase();
  const name = normalize(card.name || "").toLowerCase();
  if (slug === fixture.slug) return true;
  return (fixture.aliases || []).some((alias) => name.includes(alias.toLowerCase()));
}

function findFixtureCard(cards: CardDoc[], fixture: CardAccuracyFixture) {
  return cards.find((card) => cardMatchesFixture(card, fixture)) || null;
}

function amountMatches(actual: unknown, expected: number | undefined) {
  if (expected === undefined) return true;
  return Number(actual) === expected;
}

function periodMatches(actual: unknown, expected: string | undefined) {
  if (!expected) return true;
  return String(actual || "").toLowerCase() === expected.toLowerCase();
}

function expectedBenefitMatches(credit: CreditDoc, expected: ExpectedBenefit) {
  if (expected.acceptable?.length) {
    return expected.acceptable.some(
      (option) => amountMatches(credit.amountUSD, option.amountUSD) && periodMatches(credit.period, option.period)
    );
  }
  return amountMatches(credit.amountUSD, expected.expectedAmountUSD) && periodMatches(credit.period, expected.expectedPeriod);
}

function expectedBenefitDescription(expected: ExpectedBenefit) {
  if (expected.acceptable?.length) {
    return expected.acceptable.map((option) => `${option.amountUSD}/${option.period}`).join(" or ");
  }
  const parts = [];
  if (expected.expectedAmountUSD !== undefined) parts.push(String(expected.expectedAmountUSD));
  if (expected.expectedPeriod) parts.push(expected.expectedPeriod);
  return parts.join("/") || "present";
}

export function validateBenefitsAccuracy(cards: CardDoc[]): AccuracyFailure[] {
  const failures: AccuracyFailure[] = [];

  for (const card of cards) {
    const slug = card.slug || card.name || "unknown";
    for (const credit of allCredits(card)) {
      const label = creditLabel(credit);
      if (!label) continue;
      const forbidden = GLOBAL_FORBIDDEN_CREDIT_PATTERNS.find((pattern) => pattern.test(label));
      if (forbidden) {
        failures.push({
          slug,
          severity: "error",
          reason: `credit looks like marketing/referral copy: "${label}"`,
        });
      }
    }
  }

  for (const fixture of FIXTURES) {
    const card = findFixtureCard(cards, fixture);
    if (!card) {
      failures.push({
        slug: fixture.slug,
        severity: "error",
        reason: `expected card not found: ${fixture.cardName}`,
        sourceUrl: fixture.sourceUrl,
      });
      continue;
    }

    const credits = allCredits(card);
    const labels = credits.map(creditLabel).filter(Boolean);

    for (const expected of fixture.mustHave || []) {
      const match = credits.find((credit) => expected.pattern.test(creditLabel(credit)));
      if (!match) {
        failures.push({
          slug: fixture.slug,
          severity: "error",
          reason: `missing expected benefit: ${expected.label}`,
          sourceUrl: fixture.sourceUrl,
        });
        continue;
      }
      if (!expectedBenefitMatches(match, expected)) {
        failures.push({
          slug: fixture.slug,
          severity: "error",
          reason: `${expected.label} value mismatch: expected ${expectedBenefitDescription(expected)}, found ${match.amountUSD}/${match.period || "missing"}`,
          sourceUrl: fixture.sourceUrl,
        });
      }
    }

    for (const forbidden of fixture.mustNotHave || []) {
      const match = labels.find((label) => forbidden.test(label));
      if (match) {
        failures.push({
          slug: fixture.slug,
          severity: "error",
          reason: `unexpected benefit on ${fixture.cardName}: "${match}"`,
          sourceUrl: fixture.sourceUrl,
        });
      }
    }
  }

  return failures;
}

export async function main() {
  const col = await getCardsCollection();
  const cards = (await col.find({}).toArray()) as CardDoc[];
  const failures = validateBenefitsAccuracy(cards);

  if (failures.length) {
    console.error("Benefits accuracy validation failed:");
    failures.slice(0, 100).forEach((failure) => {
      console.error(`- ${failure.slug}: ${failure.reason}`);
      if (failure.sourceUrl) console.error(`  Source: ${failure.sourceUrl}`);
    });
    process.exit(1);
  }

  console.log(`Benefits accuracy validation passed (${cards.length} cards checked, ${FIXTURES.length} fixtures)`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Accuracy validation error:", err);
    process.exit(2);
  });
}
