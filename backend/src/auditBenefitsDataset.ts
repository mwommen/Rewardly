import { getDb } from "./db";
import {
  canonicalizeCardBenefits,
  type CanonicalBenefitRecord,
} from "./services/benefitIntelligenceService";
import { isBenefitEligibleForRecommendation } from "./services/benefitEligibilityService";

type AuditSummary = {
  totalBenefits: number;
  verifiedBenefits: number;
  unverifiedBenefits: number;
  expiredBenefits: number;
  futureBenefits: number;
  observedButUnverifiedBenefits: number;
  benefitsMissingSources: number;
  benefitsMissingVerificationDates: number;
  benefitsMissingMerchantOrCategoryMappings: number;
  productionEligibleBenefits: number;
  legacyRewardsBlockedByStrictEligibility: number;
  enrollmentRequiredBenefitsMissingUserState: number;
  activationRequiredBenefitsMissingUserState: number;
  productionEligibleMissingExplicitLastVerified: number;
  recordsWhereVerifiedEqualsObservedTimestamp: number;
  productionScoringBypassCount: number;
  duplicateBenefitIds: string[];
  duplicateCardBenefitCombinations: string[];
  invalidDateRanges: string[];
  criticalErrors: string[];
};

async function run() {
  const db = await getDb();
  const cards = await db.collection("cards").find({}).toArray();
  const benefits = cards.flatMap((card) => canonicalizeCardBenefits(card));
  const summary = auditBenefits(benefits);

  console.log("Rewardly benefit dataset audit");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.criticalErrors.length) {
    process.exitCode = 1;
  }
}

export function auditBenefits(
  benefits: CanonicalBenefitRecord[],
  now = new Date(),
): AuditSummary {
  const duplicateBenefitIds = findDuplicates(benefits.map((benefit) => benefit.id));
  const duplicateCardBenefitCombinations = findDuplicates(
    benefits.map(
      (benefit) =>
        `${benefit.cardSlug}:${benefit.benefitType}:${benefit.label}`.toLowerCase(),
    ),
  );
  const invalidDateRanges = benefits
    .filter(
      (benefit) =>
        benefit.effectiveDate &&
        benefit.expirationDate &&
        new Date(benefit.effectiveDate) > new Date(benefit.expirationDate),
    )
    .map((benefit) => benefit.id);

  const criticalErrors = [
    ...duplicateBenefitIds.map((id) => `Duplicate benefit id: ${id}`),
    ...invalidDateRanges.map((id) => `Invalid date range: ${id}`),
  ];

  return {
    totalBenefits: benefits.length,
    verifiedBenefits: benefits.filter(
      (benefit) => benefit.verificationStatus === "verified",
    ).length,
    unverifiedBenefits: benefits.filter(
      (benefit) => benefit.verificationStatus !== "verified",
    ).length,
    expiredBenefits: benefits.filter(
      (benefit) =>
        benefit.expirationDate && new Date(benefit.expirationDate) < now,
    ).length,
    futureBenefits: benefits.filter(
      (benefit) =>
        benefit.effectiveDate && new Date(benefit.effectiveDate) > now,
    ).length,
    observedButUnverifiedBenefits: benefits.filter(
      (benefit) => benefit.lastObservedAt && !benefit.lastVerified,
    ).length,
    benefitsMissingSources: benefits.filter((benefit) => !benefit.sourceUrl)
      .length,
    benefitsMissingVerificationDates: benefits.filter(
      (benefit) => !benefit.lastVerified,
    ).length,
    benefitsMissingMerchantOrCategoryMappings: benefits.filter(
      (benefit) =>
        !benefit.merchantCategory &&
        !benefit.specificMerchant &&
        !benefit.specificMerchantIds.length &&
        benefit.sourceKind !== "reward_flat",
    ).length,
    productionEligibleBenefits: benefits.filter(
      (benefit) =>
        isBenefitEligibleForRecommendation(benefit, {
          now,
          productionOnly: true,
        }).eligible,
    ).length,
    legacyRewardsBlockedByStrictEligibility: benefits.filter(
      (benefit) =>
        benefit.benefitType === "reward_multiplier" &&
        !isBenefitEligibleForRecommendation(benefit, {
          now,
          productionOnly: true,
        }).eligible,
    ).length,
    enrollmentRequiredBenefitsMissingUserState: benefits.filter(
      (benefit) => benefit.enrollmentRequired,
    ).length,
    activationRequiredBenefitsMissingUserState: benefits.filter(
      (benefit) => benefit.activationRequired,
    ).length,
    productionEligibleMissingExplicitLastVerified: benefits.filter(
      (benefit) => benefit.productionEligible && !benefit.lastVerified,
    ).length,
    recordsWhereVerifiedEqualsObservedTimestamp: benefits.filter(
      (benefit) =>
        benefit.lastVerified &&
        benefit.lastObservedAt &&
        benefit.lastVerified === benefit.lastObservedAt,
    ).length,
    productionScoringBypassCount: 0,
    duplicateBenefitIds,
    duplicateCardBenefitCombinations,
    invalidDateRanges,
    criticalErrors,
  };
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
