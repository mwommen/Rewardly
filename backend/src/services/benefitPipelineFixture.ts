import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";
import { getBenefitSource } from "./benefitSourceRegistryService";

export const fixtureApprovedBenefit: CanonicalBenefitRecord = {
  id: "amex-platinum:merchant-credit:amex-platinum-lululemon-credit",
  cardId: "amex-platinum",
  cardSlug: "amex-platinum",
  cardIssuer: "American Express",
  cardName: "The Platinum Card from American Express",
  benefitName: "$75 statement credit at lululemon",
  benefitDescription: "$75 statement credit at lululemon each quarter",
  benefitType: "statement_credit",
  rewardMechanism: "statement_credit",
  label: "$75 statement credit at lululemon each quarter",
  merchantCategory: null,
  specificMerchantIds: ["lululemon", "lululemon.com"],
  specificMerchant: "lululemon",
  eligiblePurchaseChannels: ["online"],
  multiplier: null,
  statementCredit: { amountUSD: 75, period: "quarter", capPerPeriodUSD: 75 },
  annualCredits: 300,
  spendingCap: { amountUSD: 75, period: "quarter" },
  minimumSpend: null,
  enrollmentRequired: true,
  activationRequired: false,
  travelBenefits: [],
  diningBenefits: [],
  shoppingBenefits: ["$75 statement credit at lululemon each quarter"],
  redemptionLimitations: ["Enrollment required"],
  exclusions: [],
  geographicRestrictions: [],
  effectiveDate: "2026-01-01T00:00:00.000Z",
  expirationDate: null,
  sourceUrl: "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
  sourceType: "issuer_official",
  sourceTitle: "The Platinum Card Benefits",
  lastObservedAt: "2026-07-01T00:00:00.000Z",
  lastVerified: "2026-07-01T00:00:00.000Z",
  verificationSource: "https://www.americanexpress.com/en-us/benefits/the-platinum-card/",
  confidenceScore: 0.95,
  verificationStatus: "verified",
  productionEligible: true,
  version: 1,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  sourceKind: "merchant_credit",
};

export const fixtureChangedBenefit: CanonicalBenefitRecord = {
  ...fixtureApprovedBenefit,
  statementCredit: { amountUSD: 100, period: "quarter", capPerPeriodUSD: 100 },
  spendingCap: { amountUSD: 100, period: "quarter" },
  annualCredits: 400,
  label: "$100 statement credit at lululemon each quarter",
  benefitName: "$100 statement credit at lululemon",
  benefitDescription: "$100 statement credit at lululemon each quarter",
  lastVerified: null,
  verificationStatus: "automatically_extracted",
  productionEligible: false,
};

export function fixtureSource() {
  const source = getBenefitSource("src:amex-platinum:benefits");
  if (!source) throw new Error("Fixture source missing");
  return source;
}

export function fixtureExtractionPayload() {
  return {
    benefits: [fixtureChangedBenefit],
    parserConfidence: 0.88,
    warnings: [],
    unsupportedFields: [],
    missingFields: [],
  };
}
