import { getCardsCollection } from "./db";
import { cleanCreditsForStorage, cleanPerksForStorage, isLikelyJunkBenefitText } from "./scrapers/benefitsQuality";

type Credit = { label?: string; name?: string; amountUSD?: number; period?: string };

const AMEX_CREDIT_PATTERNS: RegExp[] = [
  /lululemon/i,
  /saks/i,
  /uber cash/i,
  /uber one/i,
  /dunkin/i,
  /clear plus/i,
  /resy/i,
  /digital entertainment/i,
  /airline fee/i,
  /hotel credit/i,
  /walmart\+?/i,
];

const AMEX_CREDIT_ALLOWLIST = new Set<string>([
  "amex-gold",
  "amex-platinum",
]);

const AMEX_GOLD_MERCHANT_CREDITS: Credit[] = [
  {
    label: "$10 monthly Dining Credit at select partners (up to $120/yr)",
    amountUSD: 10,
    period: "month",
  },
  {
    label: "$50 Resy Credit semi-annually (up to $100/yr)",
    amountUSD: 50,
    period: "semi-annual",
  },
  {
    label: "$7 Dunkin' Credit monthly (up to $84/yr)",
    amountUSD: 7,
    period: "month",
  },
];

const AMEX_GOLD_RECURRING_CREDITS: Credit[] = [
  {
    label: "$10 monthly Uber Cash (up to $120/yr)",
    amountUSD: 10,
    period: "month",
  },
];

const AMEX_GOLD_FORBIDDEN_PATTERNS: RegExp[] = [
  /lululemon/i,
  /saks/i,
  /clear plus/i,
  /walmart\+?/i,
  /airline fee/i,
  /hotel credit/i,
  /digital entertainment/i,
  /\$400.*resy/i,
  /\$200.*uber cash/i,
  /uber one/i,
];

const CHASE_SAPPHIRE_PREFERRED_RECURRING_CREDITS: Credit[] = [
  {
    label: "$50 Annual Chase Travel Hotel Credit",
    amountUSD: 50,
    period: "year",
  },
];

const CAPITAL_ONE_VENTURE_X_RECURRING_CREDITS: Credit[] = [
  {
    label: "$300 Capital One Travel credit",
    amountUSD: 300,
    period: "year",
  },
  {
    label: "Up to $100 credit for Global Entry or TSA PreCheck",
    amountUSD: 100,
    period: "year",
  },
];

function isAmexCredit(line: string) {
  return AMEX_CREDIT_PATTERNS.some((rx) => rx.test(line));
}

function normalizeLabel(credit: Credit) {
  return String(credit.label || credit.name || "").trim();
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function isJunkCredit(credit: Credit) {
  const label = normalizeLabel(credit);
  if (!label) return true;
  if (isLikelyJunkBenefitText(label)) return true;
  if (/[<>]/.test(label)) return true;
  if (/&#\d+;/.test(label)) return true;
  if (/\$\{[^}]+\}/.test(label)) return true;
  if (/(refer.*friend|each friend who gets|bonus points per year.*friend|cash back per year.*friend|click the button below)/i.test(label)) {
    return true;
  }
  if (/statement credit at checkout/i.test(label)) return true;
  if (/price drops within \d+ days/i.test(label)) return true;
  if (/^earn\b/i.test(label) && /\b(points?|miles|cash back|x total points|x points)\b/i.test(label)) {
    return true;
  }
  if (/(data-react-helmet|window\.__|axp-footer|credit journey|hamnav|jpmc|marketplace|stylesheet|canonical|viewport|favicon)/i.test(label)) {
    return true;
  }
  return false;
}

function mergeCanonicalCredits(existing: Credit[], required: Credit[]) {
  return cleanCreditsForStorage([...existing, ...required]);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const col = await getCardsCollection();
  const cards = await col.find({}).toArray();

  let cleanedPerks = 0;
  let cleanedCredits = 0;
  let addedCredits = 0;
  let updated = 0;

  for (const card of cards) {
    const raw = card as any;
    const slug = String(raw.slug || "");
    const issuer = String(raw.issuer || "");
    const next: Record<string, any> = {};

    if (Array.isArray(raw.perks) && raw.perks.length) {
      const cleaned = cleanPerksForStorage(raw.perks);
      if (!arraysEqual(cleaned, raw.perks)) {
        next.perks = cleaned;
        cleanedPerks += Math.max(0, raw.perks.length - cleaned.length);
      }
    }

    const merchantCredits: Credit[] = Array.isArray(raw.merchantCredits) ? raw.merchantCredits : [];
    const recurringCredits: Credit[] = Array.isArray(raw.recurringCredits) ? raw.recurringCredits : [];

    const creditFilter = (c: Credit) => {
      if (isJunkCredit(c)) return false;
      if (issuer.toLowerCase() === "american express" && !AMEX_CREDIT_ALLOWLIST.has(slug) && isAmexCredit(normalizeLabel(c))) {
        return false;
      }
      return true;
    };

    const filteredMerchant = merchantCredits.filter(creditFilter);
    const filteredRecurring = recurringCredits.filter(creditFilter);
    let cleanedMerchant = cleanCreditsForStorage(filteredMerchant);
    let cleanedRecurring = cleanCreditsForStorage(filteredRecurring);

    if (slug === "amex-gold") {
      cleanedMerchant = cleanedMerchant.filter(
        (credit) => !AMEX_GOLD_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(normalizeLabel(credit)))
      );
      cleanedRecurring = cleanedRecurring.filter(
        (credit) => !AMEX_GOLD_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(normalizeLabel(credit)))
      );
      cleanedMerchant = mergeCanonicalCredits(cleanedMerchant, AMEX_GOLD_MERCHANT_CREDITS);
      cleanedRecurring = mergeCanonicalCredits(cleanedRecurring, AMEX_GOLD_RECURRING_CREDITS);
    }

    if (slug === "chase-sapphire-preferred") {
      cleanedRecurring = cleanedRecurring.filter((credit) => {
        const label = normalizeLabel(credit);
        if (Number(credit.amountUSD) === 50 && String(credit.period || "").toLowerCase() === "year") {
          return /annual chase travel.*hotel credit/i.test(label);
        }
        return true;
      });
      cleanedRecurring = mergeCanonicalCredits(cleanedRecurring, CHASE_SAPPHIRE_PREFERRED_RECURRING_CREDITS);
    }

    if (["capital-one-venture-x", "capitalone-venture-x", "venture-x"].includes(slug)) {
      cleanedMerchant = [];
      cleanedRecurring = cleanCreditsForStorage(CAPITAL_ONE_VENTURE_X_RECURRING_CREDITS);
    }

    if (cleanedMerchant.length !== merchantCredits.length || !cleanedMerchant.every((credit, index) => normalizeLabel(credit) === normalizeLabel(merchantCredits[index] || {}))) {
      next.merchantCredits = cleanedMerchant;
      cleanedCredits += Math.max(0, merchantCredits.length - cleanedMerchant.length);
      addedCredits += Math.max(0, cleanedMerchant.length - merchantCredits.length);
    }
    if (cleanedRecurring.length !== recurringCredits.length || !cleanedRecurring.every((credit, index) => normalizeLabel(credit) === normalizeLabel(recurringCredits[index] || {}))) {
      next.recurringCredits = cleanedRecurring;
      cleanedCredits += Math.max(0, recurringCredits.length - cleanedRecurring.length);
      addedCredits += Math.max(0, cleanedRecurring.length - recurringCredits.length);
    }

    if (Object.keys(next).length) {
      updated += 1;
      if (apply) {
        await col.updateOne({ _id: card._id }, { $set: next });
      }
    }
  }

  console.log("🧹 Benefits cleanup summary");
  console.log("Cards scanned:", cards.length);
  console.log("Cards updated:", updated);
  console.log("Perks removed:", cleanedPerks);
  console.log("Credits removed:", cleanedCredits);
  console.log("Credits added:", addedCredits);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to save changes.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
