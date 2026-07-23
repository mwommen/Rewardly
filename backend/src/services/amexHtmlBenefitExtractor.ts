import * as cheerio from "cheerio";
import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";
import type { BenefitSourceRecord, ExtractorInput, ExtractorResult } from "./benefitPipelineTypes";
import type { BenefitPipelineLogger } from "./benefitPipelineLogger";
import { silentBenefitPipelineLogger } from "./benefitPipelineLogger";

type ParsedBenefit = {
  id?: string;
  sourceKind?: CanonicalBenefitRecord["sourceKind"];
  benefitType?: CanonicalBenefitRecord["benefitType"];
  rewardMechanism?: CanonicalBenefitRecord["rewardMechanism"];
  name?: string;
  description?: string;
  label?: string;
  category?: string;
  merchant?: string;
  merchants?: string[];
  channels?: CanonicalBenefitRecord["eligiblePurchaseChannels"];
  multiplier?: number | null;
  amountUSD?: number | null;
  period?: string | null;
  capPerPeriodUSD?: number | null;
  annualCredits?: number | null;
  enrollmentRequired?: boolean;
  activationRequired?: boolean;
  travelBenefits?: string[];
  diningBenefits?: string[];
  shoppingBenefits?: string[];
  redemptionLimitations?: string[];
  exclusions?: string[];
  geographicRestrictions?: string[];
  effectiveDate?: string | null;
  expirationDate?: string | null;
  confidenceScore?: number;
};

export function extractAmexHtmlSource(
  input: ExtractorInput,
  logger: BenefitPipelineLogger = silentBenefitPipelineLogger,
): ExtractorResult {
  const observedAt = input.observedAt || new Date().toISOString();
  const html = htmlFromPayload(input.fixturePayload);

  logger({
    stage: "extraction",
    action: "amex_html_extract",
    sourceId: input.source.sourceId,
    status: "started",
    metadata: { bytes: html.length },
    timestamp: observedAt,
  });

  if (!html.trim()) {
    logger({
      stage: "extraction",
      action: "amex_html_extract",
      sourceId: input.source.sourceId,
      status: "failed",
      message: "HTML fixture payload was empty",
      timestamp: observedAt,
    });
    return {
      sourceId: input.source.sourceId,
      observedAt,
      rawExtractedData: { htmlLength: 0, extractedBlocks: [] },
      normalizedBenefits: [],
      parserConfidence: 0,
      warnings: ["HTML fixture payload was empty"],
      unsupportedFields: [],
      missingFields: ["html"],
    };
  }

  const $ = cheerio.load(html);
  const parsed = $("[data-rewardly-benefit]")
    .toArray()
    .map((element) => parseBenefitBlock($(element).data()));
  const warnings: string[] = [];
  const missingFields: string[] = [];

  const normalizedBenefits = parsed.flatMap((benefit, index) => {
    const missing = requiredMissingFields(benefit);
    if (missing.length) {
      missingFields.push(...missing.map((field) => `benefit[${index}].${field}`));
      return [];
    }
    return [normalizeAmexBenefit(input.source, benefit, observedAt)];
  });

  if (!parsed.length) warnings.push("No Amex benefit blocks were found in the HTML fixture");
  if (missingFields.length) warnings.push("Some benefit blocks were skipped because required fields were missing");

  logger({
    stage: "normalization",
    action: "amex_html_normalize",
    sourceId: input.source.sourceId,
    status: "succeeded",
    metadata: {
      parsedBlocks: parsed.length,
      candidateBenefits: normalizedBenefits.length,
      warnings: warnings.length,
    },
    timestamp: observedAt,
  });

  return {
    sourceId: input.source.sourceId,
    observedAt,
    rawExtractedData: {
      htmlLength: html.length,
      extractedBlocks: parsed,
    },
    normalizedBenefits,
    parserConfidence: normalizedBenefits.length ? minConfidence(normalizedBenefits) : 0,
    warnings,
    unsupportedFields: [],
    missingFields: Array.from(new Set(missingFields)),
  };
}

function htmlFromPayload(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (
    payload &&
    typeof payload === "object" &&
    typeof (payload as { html?: unknown }).html === "string"
  ) {
    return (payload as { html: string }).html;
  }
  return "";
}

function parseBenefitBlock(data: Record<string, unknown>): ParsedBenefit {
  return {
    id: stringValue(data.benefitId || data.id),
    sourceKind: stringValue(data.sourceKind) as ParsedBenefit["sourceKind"],
    benefitType: stringValue(data.benefitType) as ParsedBenefit["benefitType"],
    rewardMechanism: stringValue(data.rewardMechanism) as ParsedBenefit["rewardMechanism"],
    name: stringValue(data.name),
    description: stringValue(data.description),
    label: stringValue(data.label),
    category: stringValue(data.category),
    merchant: stringValue(data.merchant),
    merchants: listValue(data.merchants),
    channels: listValue(data.channels) as ParsedBenefit["channels"],
    multiplier: numberValue(data.multiplier),
    amountUSD: numberValue(data.amountUsd),
    period: stringValue(data.period),
    capPerPeriodUSD: numberValue(data.capPerPeriodUsd),
    annualCredits: numberValue(data.annualCredits),
    enrollmentRequired: booleanValue(data.enrollmentRequired),
    activationRequired: booleanValue(data.activationRequired),
    travelBenefits: listValue(data.travelBenefits),
    diningBenefits: listValue(data.diningBenefits),
    shoppingBenefits: listValue(data.shoppingBenefits),
    redemptionLimitations: listValue(data.redemptionLimitations),
    exclusions: listValue(data.exclusions),
    geographicRestrictions: listValue(data.geographicRestrictions),
    effectiveDate: stringValue(data.effectiveDate),
    expirationDate: stringValue(data.expirationDate),
    confidenceScore: numberValue(data.confidenceScore) ?? 0.86,
  };
}

function normalizeAmexBenefit(
  source: BenefitSourceRecord,
  benefit: ParsedBenefit,
  observedAt: string,
): CanonicalBenefitRecord {
  const benefitType = benefit.benefitType || inferBenefitType(benefit);
  const sourceKind = benefit.sourceKind || inferSourceKind(benefit);
  const rewardMechanism = benefit.rewardMechanism || inferRewardMechanism(benefit);
  const amountUSD = benefit.amountUSD ?? null;
  const period = benefit.period ?? null;
  const capPerPeriodUSD = benefit.capPerPeriodUSD ?? amountUSD;
  const label = benefit.label || benefit.name || "American Express benefit";

  return {
    id: benefit.id as string,
    cardId: source.cardSlug,
    cardSlug: source.cardSlug,
    cardIssuer: source.issuer,
    cardName: cardNameForSource(source.cardSlug),
    benefitName: benefit.name || label,
    benefitDescription: benefit.description || label,
    benefitType,
    rewardMechanism,
    label,
    merchantCategory: benefit.category || null,
    specificMerchantIds: benefit.merchants || [],
    specificMerchant: benefit.merchant || null,
    eligiblePurchaseChannels: benefit.channels?.length ? benefit.channels : ["any"],
    multiplier: benefit.multiplier ?? null,
    statementCredit:
      amountUSD !== null || period || capPerPeriodUSD !== null
        ? { amountUSD, period, capPerPeriodUSD }
        : null,
    annualCredits: benefit.annualCredits ?? annualizedCredit(amountUSD, period),
    spendingCap:
      capPerPeriodUSD !== null || period
        ? { amountUSD: capPerPeriodUSD, period }
        : null,
    minimumSpend: null,
    enrollmentRequired: Boolean(benefit.enrollmentRequired),
    activationRequired: Boolean(benefit.activationRequired),
    travelBenefits: benefit.travelBenefits || [],
    diningBenefits: benefit.diningBenefits || [],
    shoppingBenefits: benefit.shoppingBenefits || [],
    redemptionLimitations: benefit.redemptionLimitations || [],
    exclusions: benefit.exclusions || [],
    geographicRestrictions: benefit.geographicRestrictions || [],
    effectiveDate: benefit.effectiveDate || null,
    expirationDate: benefit.expirationDate || null,
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType === "issuer_terms" ? "issuer_terms" : "issuer_official",
    sourceTitle: "American Express official fixture",
    lastObservedAt: observedAt,
    lastVerified: null,
    verificationSource: source.sourceUrl,
    confidenceScore: benefit.confidenceScore ?? 0.86,
    verificationStatus: "automatically_extracted",
    productionEligible: false,
    version: 1,
    createdAt: observedAt,
    updatedAt: observedAt,
    sourceKind,
  };
}

function requiredMissingFields(benefit: ParsedBenefit) {
  const missing: string[] = [];
  if (!benefit.id) missing.push("id");
  if (!benefit.name && !benefit.label) missing.push("name");
  if (!benefit.description && !benefit.label) missing.push("description");
  return missing;
}

function inferBenefitType(benefit: ParsedBenefit): CanonicalBenefitRecord["benefitType"] {
  if (benefit.multiplier) return "reward_multiplier";
  if (benefit.amountUSD !== null && benefit.amountUSD !== undefined) return "statement_credit";
  if (benefit.travelBenefits?.length) return "travel_benefit";
  return "other";
}

function inferSourceKind(benefit: ParsedBenefit): CanonicalBenefitRecord["sourceKind"] {
  if (benefit.multiplier && benefit.category) return "reward_category";
  if (benefit.multiplier) return "reward_flat";
  if (benefit.amountUSD !== null && benefit.amountUSD !== undefined) {
    return benefit.merchant || benefit.merchants?.length ? "merchant_credit" : "recurring_credit";
  }
  if (benefit.travelBenefits?.length) return "insurance";
  return "perk";
}

function inferRewardMechanism(benefit: ParsedBenefit): CanonicalBenefitRecord["rewardMechanism"] {
  if (benefit.amountUSD !== null && benefit.amountUSD !== undefined) return "statement_credit";
  if (benefit.multiplier) return "points";
  if (benefit.travelBenefits?.length) return "protection";
  return "unknown";
}

function annualizedCredit(amountUSD: number | null, period: string | null) {
  if (amountUSD === null) return null;
  if (period === "month") return amountUSD * 12;
  if (period === "quarter") return amountUSD * 4;
  if (period === "semi-annual") return amountUSD * 2;
  if (period === "year") return amountUSD;
  return null;
}

function cardNameForSource(cardSlug: string) {
  if (cardSlug === "amex-platinum") return "The Platinum Card from American Express";
  if (cardSlug === "amex-gold") return "American Express Gold Card";
  return "American Express Card";
}

function minConfidence(benefits: CanonicalBenefitRecord[]) {
  return Math.min(...benefits.map((benefit) => benefit.confidenceScore));
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function listValue(value: unknown) {
  const text = stringValue(value);
  if (!text) return [];
  return text
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberValue(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  return String(value || "").toLowerCase() === "true";
}
