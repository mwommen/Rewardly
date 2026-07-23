import { getDb } from "../db";

export type CanonicalBenefitType =
  | "reward_multiplier"
  | "statement_credit"
  | "travel_benefit"
  | "dining_benefit"
  | "shopping_benefit"
  | "protection"
  | "insurance"
  | "access"
  | "signup_offer"
  | "other";

export type VerificationStatus =
  | "unverified"
  | "automatically_extracted"
  | "needs_review"
  | "verified"
  | "rejected"
  | "expired"
  | "stale";

export type BenefitSourceType =
  | "issuer_official"
  | "issuer_terms"
  | "network_official"
  | "manually_entered"
  | "third_party_reference"
  | "missing";

export type RewardMechanism = "cash_back" | "points" | "miles" | "statement_credit" | "access" | "protection" | "unknown";

export type PurchaseChannel = "online" | "in_store" | "travel_portal" | "issuer_portal" | "mobile_app" | "any";

export type CreditFrequency = "purchase" | "month" | "quarter" | "semi-annual" | "year" | "one_time" | "unknown";

export type BenefitChangeType =
  | "created"
  | "updated"
  | "expired"
  | "source_changed"
  | "verification_changed"
  | "eligibility_changed";

export type BenefitVersionRecord = {
  benefitId: string;
  previousValue: CanonicalBenefitRecord | null;
  newValue: CanonicalBenefitRecord;
  changedAt: string;
  changeSource: string;
  changeType: BenefitChangeType;
  approvalStatus: VerificationStatus;
};

export type CanonicalBenefitRecord = {
  id: string;
  cardId: string;
  cardSlug: string;
  cardIssuer: string | null;
  cardName: string;
  benefitName: string;
  benefitDescription: string;
  benefitType: CanonicalBenefitType;
  rewardMechanism: RewardMechanism;
  label: string;
  merchantCategory: string | null;
  specificMerchantIds: string[];
  specificMerchant: string | null;
  eligiblePurchaseChannels: PurchaseChannel[];
  multiplier: number | null;
  statementCredit: {
    amountUSD: number | null;
    period: CreditFrequency | string | null;
    capPerPeriodUSD: number | null;
  } | null;
  annualCredits: number | null;
  spendingCap: {
    amountUSD: number | null;
    period: CreditFrequency | string | null;
  } | null;
  minimumSpend: {
    amountUSD: number | null;
    period: CreditFrequency | string | null;
  } | null;
  enrollmentRequired: boolean;
  activationRequired: boolean;
  travelBenefits: string[];
  diningBenefits: string[];
  shoppingBenefits: string[];
  redemptionLimitations: string[];
  exclusions: string[];
  geographicRestrictions: string[];
  effectiveDate: string | null;
  expirationDate: string | null;
  sourceUrl: string | null;
  sourceType: BenefitSourceType;
  sourceTitle: string | null;
  lastObservedAt: string | null;
  lastVerified: string | null;
  verificationSource: string | null;
  confidenceScore: number;
  verificationStatus: VerificationStatus;
  productionEligible: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceKind:
    | "reward_category"
    | "reward_flat"
    | "reward_rotating"
    | "merchant_credit"
    | "recurring_credit"
    | "perk"
    | "insurance"
    | "access"
    | "signup_offer";
};

type CanonicalizeOptions = {
  now?: Date;
};

const STALE_AFTER_DAYS = 180;
const REVIEW_AFTER_DAYS = 365;

export async function listCanonicalBenefits() {
  const db = await getDb();
  const cards = await db.collection("cards").find({}).toArray();
  return cards.flatMap((card) => canonicalizeCardBenefits(card));
}

export async function getBenefitReviewQueue() {
  const benefits = await listCanonicalBenefits();
  return benefits
    .filter(
      (benefit) =>
        benefit.verificationStatus !== "verified" ||
        benefit.confidenceScore < 0.7 ||
        !benefit.sourceUrl ||
        !benefit.lastVerified ||
        !benefit.productionEligible,
    )
    .sort((a, b) => a.confidenceScore - b.confidenceScore);
}

export function buildBenefitVersionRecord(input: {
  previousValue: CanonicalBenefitRecord | null;
  newValue: CanonicalBenefitRecord;
  changeSource: string;
  changeType: BenefitChangeType;
  changedAt?: string;
}): BenefitVersionRecord {
  return {
    benefitId: input.newValue.id,
    previousValue: input.previousValue,
    newValue: input.newValue,
    changedAt: input.changedAt || new Date().toISOString(),
    changeSource: input.changeSource,
    changeType: input.changeType,
    approvalStatus: input.newValue.verificationStatus,
  };
}

export function canonicalizeCardBenefits(
  card: any,
  options: CanonicalizeOptions = {},
): CanonicalBenefitRecord[] {
  const benefits = card?.benefitsDetail || {};
  const sourceUrl = benefits.sourceUrl || card?.sourceUrl || null;
  const lastVerified =
    benefits.lastVerified ||
    card?.lastVerified ||
    null;
  const observedAt =
    benefits.lastObservedAt ||
    card?.lastObservedAt ||
    benefits.lastScraped ||
    card?.lastScraped ||
    card?.lastUpdated ||
    null;
  const base = {
    cardId: String(card?._id || card?.slug || card?.name || "unknown-card"),
    cardSlug: String(card?.slug || card?.name || "unknown-card"),
    cardIssuer: card?.issuer || null,
    cardName: String(card?.name || card?.slug || "Unknown card"),
    sourceUrl,
    sourceType: sourceTypeFromValue(benefits.sourceType || card?.sourceType, sourceUrl),
    sourceTitle: benefits.sourceTitle || card?.sourceTitle || null,
    lastObservedAt: observedAt,
    lastVerified,
    verificationSource: sourceUrl,
    productionEligible: Boolean(card?.productionEligible ?? benefits.productionEligible),
  };

  const records: CanonicalBenefitRecord[] = [];

  for (const entry of normalizeArray<any>(
    benefits.rewardsByCategory || card?.rewardsByCategory,
  )) {
    const keys = normalizeArray<string>(entry?.keys);
    records.push(
      makeRecord({
        ...base,
        idParts: ["reward", ...keys, String(entry?.rate || "")],
        benefitType: "reward_multiplier",
          label: rewardLabel(entry?.rate, keys),
          merchantCategory: keys[0] || null,
          specificMerchantIds: normalizeArray<string>(entry?.eligibleWhen?.merchantPatterns),
          eligiblePurchaseChannels: normalizeChannels(entry?.eligibleWhen?.channels),
          multiplier: parseMultiplier(entry?.rate),
          rewardMechanism: rewardMechanismFromUnit(entry?.unit, entry?.rate),
          spendingCap: entry?.capPerPeriodUSD
            ? { amountUSD: numberOrNull(entry.capPerPeriodUSD), period: entry.period || null }
            : null,
          confidenceScore: mergeConfidence(entry?.confidence, benefits.confidence),
          sourceKind: "reward_category",
        }),
    );
  }

  const rewardsMap =
    (benefits.rewardsByCategory || card?.rewardsByCategory) &&
    !Array.isArray(benefits.rewardsByCategory || card?.rewardsByCategory) &&
    typeof (benefits.rewardsByCategory || card?.rewardsByCategory) === "object"
      ? benefits.rewardsByCategory || card?.rewardsByCategory
      : null;
  if (rewardsMap) {
    for (const [category, rate] of Object.entries(rewardsMap)) {
      records.push(
        makeRecord({
          ...base,
          idParts: ["reward", category, String(rate)],
          benefitType: "reward_multiplier",
          label: rewardLabel(rate, [category]),
          merchantCategory: category,
          multiplier: parseMultiplier(rate),
          rewardMechanism: rewardMechanismFromUnit(undefined, rate),
          confidenceScore: mergeConfidence(undefined, benefits.confidence),
          sourceKind: "reward_category",
        }),
      );
    }
  }

  for (const entry of normalizeArray<any>(benefits.rewardsFlat || card?.rewardsFlat)) {
    records.push(
      makeRecord({
        ...base,
        idParts: ["flat", String(entry?.rate || "")],
        benefitType: "reward_multiplier",
          label: rewardLabel(entry?.rate, ["all purchases"]),
          merchantCategory: "other",
          multiplier: parseMultiplier(entry?.rate),
        rewardMechanism: rewardMechanismFromUnit(entry?.unit, entry?.rate),
        confidenceScore: mergeConfidence(entry?.confidence, benefits.confidence),
        sourceKind: "reward_flat",
      }),
    );
  }

  for (const window of normalizeArray<any>(
    benefits.rewardsRotating || card?.rewardsRotating,
  )) {
    for (const entry of normalizeArray<any>(window?.categories)) {
      const keys = normalizeArray<string>(entry?.keys);
      records.push(
        makeRecord({
          ...base,
          idParts: ["rotating", ...keys, String(entry?.rate || "")],
          benefitType: "reward_multiplier",
          label: rewardLabel(entry?.rate, keys),
          merchantCategory: keys[0] || null,
          specificMerchantIds: normalizeArray<string>(entry?.eligibleWhen?.merchantPatterns),
          eligiblePurchaseChannels: normalizeChannels(entry?.eligibleWhen?.channels),
          multiplier: parseMultiplier(entry?.rate),
          rewardMechanism: rewardMechanismFromUnit(entry?.unit, entry?.rate),
          redemptionLimitations: window?.activationRequired
            ? ["Activation required"]
            : [],
          activationRequired: Boolean(window?.activationRequired),
          effectiveDate: window?.start || null,
          expirationDate: window?.end || null,
          confidenceScore: mergeConfidence(entry?.confidence, benefits.confidence),
          sourceKind: "reward_rotating",
        }),
      );
    }
  }

  for (const credit of normalizeArray<any>(benefits.merchantCredits || card?.merchantCredits)) {
    records.push(
      makeRecord({
        ...base,
        idParts: ["merchant-credit", credit?.id || credit?.label],
        benefitType: "statement_credit",
        label: String(credit?.label || "$ statement credit"),
        merchantCategory: null,
        specificMerchant:
          normalizeArray<string>(credit?.eligibleWhen?.merchantPatterns)[0] ||
          inferMerchantFromLabel(credit?.label),
        specificMerchantIds: normalizeArray<string>(credit?.eligibleWhen?.merchantPatterns),
        eligiblePurchaseChannels: normalizeChannels(credit?.eligibleWhen?.channels),
        statementCredit: {
          amountUSD: numberOrNull(credit?.amountUSD),
          period: credit?.period || null,
          capPerPeriodUSD: numberOrNull(credit?.capPerPeriodUSD),
        },
        spendingCap: {
          amountUSD: numberOrNull(credit?.capPerPeriodUSD),
          period: credit?.period || null,
        },
        enrollmentRequired: Boolean(credit?.requiresEnrollment),
        annualCredits: annualizedCredit(credit),
        redemptionLimitations: credit?.requiresEnrollment
          ? ["Enrollment required"]
          : [],
        expirationDate: credit?.expiresAt || null,
        sourceUrl: credit?.sourceUrl || sourceUrl,
        sourceType: sourceTypeFromValue(credit?.sourceType || benefits.sourceType || card?.sourceType, credit?.sourceUrl || sourceUrl),
        confidenceScore: mergeConfidence(credit?.confidence, benefits.confidence),
        sourceKind: "merchant_credit",
      }),
    );
  }

  for (const credit of normalizeArray<any>(
    benefits.recurringCredits || card?.recurringCredits,
  )) {
    records.push(
      makeRecord({
        ...base,
        idParts: ["recurring-credit", credit?.id || credit?.label],
        benefitType: classifyBenefitType(credit?.label),
        label: String(credit?.label || "$ statement credit"),
        merchantCategory: null,
        specificMerchant: credit?.partner || inferMerchantFromLabel(credit?.label),
        specificMerchantIds: normalizeArray<string>(credit?.eligibleWhen?.merchantPatterns),
        statementCredit: {
          amountUSD: numberOrNull(credit?.amountUSD),
          period: credit?.period || null,
          capPerPeriodUSD: null,
        },
        enrollmentRequired: Boolean(credit?.requiresEnrollment),
        annualCredits: annualizedCredit(credit),
        redemptionLimitations: credit?.requiresEnrollment
          ? ["Enrollment required"]
          : [],
        sourceUrl: credit?.sourceUrl || sourceUrl,
        sourceType: sourceTypeFromValue(credit?.sourceType || benefits.sourceType || card?.sourceType, credit?.sourceUrl || sourceUrl),
        confidenceScore: mergeConfidence(credit?.confidence, benefits.confidence),
        sourceKind: "recurring_credit",
      }),
    );
  }

  for (const label of normalizeArray<string>(benefits.perks || card?.perks)) {
    records.push(
      makeRecord({
        ...base,
        idParts: ["perk", label],
        benefitType: classifyBenefitType(label),
        label,
        merchantCategory: inferCategoryFromLabel(label),
        confidenceScore: mergeConfidence(undefined, benefits.confidence, 0.62),
        sourceKind: "perk",
      }),
    );
  }

  for (const item of normalizeArray<any>(benefits.insurances)) {
    records.push(
      makeRecord({
        ...base,
        idParts: ["insurance", item?.id || item?.label],
        benefitType: "insurance",
        label: String(item?.label || item?.details || "Insurance benefit"),
        redemptionLimitations: item?.details ? [String(item.details)] : [],
        sourceUrl: item?.sourceUrl || sourceUrl,
        sourceType: sourceTypeFromValue(item?.sourceType || benefits.sourceType || card?.sourceType, item?.sourceUrl || sourceUrl),
        confidenceScore: mergeConfidence(item?.confidence, benefits.confidence),
        sourceKind: "insurance",
      }),
    );
  }

  for (const item of normalizeArray<any>(benefits.access)) {
    records.push(
      makeRecord({
        ...base,
        idParts: ["access", item?.id || item?.label],
        benefitType: "access",
        label: String(item?.label || item?.details || "Access benefit"),
        redemptionLimitations: item?.details ? [String(item.details)] : [],
        sourceUrl: item?.sourceUrl || sourceUrl,
        sourceType: sourceTypeFromValue(item?.sourceType || benefits.sourceType || card?.sourceType, item?.sourceUrl || sourceUrl),
        confidenceScore: mergeConfidence(item?.confidence, benefits.confidence),
        sourceKind: "access",
      }),
    );
  }

  if (benefits.signupOffer || card?.signupOffer) {
    const label = String(benefits.signupOffer || card.signupOffer);
    records.push(
      makeRecord({
        ...base,
        idParts: ["signup", label],
        benefitType: "signup_offer",
        label,
        confidenceScore: mergeConfidence(undefined, benefits.confidence, 0.7),
        sourceKind: "signup_offer",
      }),
    );
  }

  return dedupeRecords(records).map((record) => ({
    ...record,
    verificationStatus: verificationStatus(record, options.now),
  }));
}

export function scoreBenefitFreshness(lastVerified?: string | null, now = new Date()) {
  if (!lastVerified) return 0.45;
  const verifiedAt = new Date(lastVerified);
  if (Number.isNaN(verifiedAt.getTime())) return 0.45;
  const ageDays = (now.getTime() - verifiedAt.getTime()) / 86_400_000;
  if (ageDays <= STALE_AFTER_DAYS) return 1;
  if (ageDays <= REVIEW_AFTER_DAYS) return 0.78;
  return 0.52;
}

function makeRecord(input: Partial<CanonicalBenefitRecord> & {
  idParts: unknown[];
  cardId: string;
  cardSlug: string;
  cardIssuer: string | null;
  cardName: string;
  benefitType: CanonicalBenefitType;
  label: string;
  confidenceScore: number;
  sourceKind: CanonicalBenefitRecord["sourceKind"];
}): CanonicalBenefitRecord {
  return {
    id: [input.cardSlug, ...input.idParts]
      .map((part) =>
        String(part || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      )
      .filter(Boolean)
      .join(":"),
    cardId: input.cardId,
    cardSlug: input.cardSlug,
    cardIssuer: input.cardIssuer,
    cardName: input.cardName,
    benefitName: input.benefitName ?? input.label,
    benefitDescription: input.benefitDescription ?? input.label,
    benefitType: input.benefitType,
    rewardMechanism: input.rewardMechanism ?? rewardMechanism(input),
    label: input.label,
    merchantCategory: input.merchantCategory ?? null,
    specificMerchantIds: input.specificMerchantIds ?? [],
    specificMerchant: input.specificMerchant ?? null,
    eligiblePurchaseChannels: input.eligiblePurchaseChannels ?? ["any"],
    multiplier: input.multiplier ?? null,
    statementCredit: input.statementCredit ?? null,
    annualCredits: input.annualCredits ?? null,
    spendingCap: input.spendingCap ?? null,
    minimumSpend: input.minimumSpend ?? null,
    enrollmentRequired: input.enrollmentRequired ?? false,
    activationRequired: input.activationRequired ?? false,
    travelBenefits: input.travelBenefits ?? travelBenefits(input.label),
    diningBenefits: input.diningBenefits ?? diningBenefits(input.label),
    shoppingBenefits: input.shoppingBenefits ?? shoppingBenefits(input.label),
    redemptionLimitations: input.redemptionLimitations ?? [],
    exclusions: input.exclusions ?? [],
    geographicRestrictions: input.geographicRestrictions ?? [],
    effectiveDate: input.effectiveDate ?? null,
    expirationDate: input.expirationDate ?? null,
    sourceUrl: input.sourceUrl ?? input.verificationSource ?? null,
    sourceType: input.sourceType ?? sourceTypeFromValue(undefined, input.sourceUrl ?? input.verificationSource),
    sourceTitle: input.sourceTitle ?? null,
    lastObservedAt: input.lastObservedAt ?? input.lastVerified ?? null,
    lastVerified: input.lastVerified ?? null,
    verificationSource: input.verificationSource ?? null,
    confidenceScore: clamp(input.confidenceScore),
    verificationStatus: "needs_review",
    productionEligible: input.productionEligible ?? false,
    version: input.version ?? 1,
    createdAt: input.createdAt ?? input.lastObservedAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? input.lastObservedAt ?? new Date().toISOString(),
    sourceKind: input.sourceKind,
  };
}

function verificationStatus(
  record: CanonicalBenefitRecord,
  now = new Date(),
): VerificationStatus {
  if (record.confidenceScore < 0.55) return "needs_review";
  if (record.expirationDate && new Date(record.expirationDate) < now) return "expired";
  if (!record.lastVerified) return "needs_review";
  const ageScore = scoreBenefitFreshness(record.lastVerified, now);
  if (ageScore >= 0.9) return "verified";
  if (ageScore >= 0.7) return "stale";
  return "needs_review";
}

function rewardMechanismFromUnit(unit: unknown, rate: unknown): RewardMechanism {
  if (unit === "cash" || unit === "points" || unit === "miles") {
    return unit === "cash" ? "cash_back" : unit;
  }
  const text = String(rate || "").toLowerCase();
  if (text.includes("%")) return "cash_back";
  if (/\bx\b/.test(text)) return "points";
  return "unknown";
}

function sourceTypeFromValue(value: unknown, sourceUrl?: string | null): BenefitSourceType {
  const normalized = String(value || "").trim();
  const allowed: BenefitSourceType[] = [
    "issuer_official",
    "issuer_terms",
    "network_official",
    "manually_entered",
    "third_party_reference",
    "missing",
  ];
  if (allowed.includes(normalized as BenefitSourceType)) {
    return normalized as BenefitSourceType;
  }
  return sourceUrl ? "issuer_official" : "missing";
}

function normalizeChannels(value: unknown): PurchaseChannel[] {
  const values = normalizeArray<string>(value)
    .map((channel) => channel.trim())
    .filter(Boolean) as PurchaseChannel[];
  return values.length ? values : ["any"];
}

function rewardMechanism(input: Partial<CanonicalBenefitRecord>): RewardMechanism {
  if (input.statementCredit) return "statement_credit";
  if (input.benefitType === "access") return "access";
  if (input.benefitType === "insurance" || input.benefitType === "protection") return "protection";
  const label = String(input.label || "").toLowerCase();
  if (/mile/.test(label)) return "miles";
  if (/point|x\b/.test(label)) return "points";
  if (/%|cash/.test(label)) return "cash_back";
  return "unknown";
}

function dedupeRecords(records: CanonicalBenefitRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = record.id || `${record.cardSlug}:${record.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mergeConfidence(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return clamp(value);
  }
  return clamp(0.72);
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseMultiplier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value || "").match(/([\d.]+)\s*x/i);
  return match ? Number(match[1]) : null;
}

function rewardLabel(rate: unknown, categories: string[]) {
  const category = categories.filter(Boolean).join(", ") || "all purchases";
  return `${String(rate || "Reward")} on ${category}`;
}

function annualizedCredit(credit: any) {
  const amount = numberOrNull(credit?.amountUSD);
  if (!amount) return null;
  const period = String(credit?.period || "").toLowerCase();
  if (period === "month") return amount * 12;
  if (period === "quarter") return amount * 4;
  if (period === "semi-annual") return amount * 2;
  return amount;
}

function classifyBenefitType(label: unknown): CanonicalBenefitType {
  const text = String(label || "").toLowerCase();
  if (/credit/.test(text)) return "statement_credit";
  if (/dining|restaurant|resy|doordash|uber eats|grubhub/.test(text))
    return "dining_benefit";
  if (/travel|airline|hotel|lounge|precheck|global entry|clear/.test(text))
    return "travel_benefit";
  if (/purchase|return|warranty|shopping|saks|lululemon/.test(text))
    return "shopping_benefit";
  if (/protection|warranty/.test(text)) return "protection";
  if (/insurance|coverage/.test(text)) return "insurance";
  if (/access|lounge/.test(text)) return "access";
  return "other";
}

function inferCategoryFromLabel(label: unknown) {
  const text = String(label || "").toLowerCase();
  if (/dining|restaurant|coffee|doordash|uber eats/.test(text)) return "dining";
  if (/travel|airline|hotel|rental car/.test(text)) return "travel";
  if (/grocery|supermarket/.test(text)) return "groceries";
  if (/gas|fuel/.test(text)) return "gas";
  if (/shopping|purchase|warranty|return|lululemon|saks/.test(text))
    return "online_shopping";
  return null;
}

function inferMerchantFromLabel(label: unknown) {
  const text = String(label || "").toLowerCase();
  const known = [
    "lululemon",
    "saks",
    "uber",
    "doordash",
    "resy",
    "walmart",
    "clear",
    "capital one travel",
  ];
  return known.find((merchant) => text.includes(merchant)) || null;
}

function travelBenefits(label: string) {
  return /travel|airline|hotel|lounge|precheck|global entry|clear/i.test(label)
    ? [label]
    : [];
}

function diningBenefits(label: string) {
  return /dining|restaurant|resy|doordash|uber eats|grubhub/i.test(label)
    ? [label]
    : [];
}

function shoppingBenefits(label: string) {
  return /purchase|return|warranty|shopping|saks|lululemon/i.test(label)
    ? [label]
    : [];
}
