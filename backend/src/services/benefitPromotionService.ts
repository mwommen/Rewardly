import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";
import { createBenefitVersionChange } from "./benefitVersioningService";
import type {
  BenefitReviewRecord,
  CandidateBenefit,
  PromotionResult,
} from "./benefitPipelineTypes";

export function promoteApprovedCandidate(input: {
  candidate: CandidateBenefit;
  review: BenefitReviewRecord;
  approvedBenefits: CanonicalBenefitRecord[];
  reviewer: string;
  notes?: string | null;
  promotedAt?: string;
}): PromotionResult {
  if (input.review.status !== "approved" || input.review.decision !== "approved") {
    return {
      promoted: false,
      benefit: null,
      previousVersion: null,
      versionRecord: null,
      rollbackToken: null,
    };
  }

  const promotedAt = input.promotedAt || new Date().toISOString();
  const previousVersion =
    input.approvedBenefits.find(
      (benefit) => benefit.id === input.candidate.normalizedData.id,
    ) || null;
  const benefit: CanonicalBenefitRecord = {
    ...input.candidate.normalizedData,
    verificationStatus: "verified",
    productionEligible: true,
    lastVerified: promotedAt,
    version: previousVersion ? previousVersion.version + 1 : 1,
    updatedAt: promotedAt,
  };
  const versionChange = createBenefitVersionChange({
    previousValue: previousVersion,
    newValue: benefit,
    changeSource: input.review.reviewId,
    changedAt: promotedAt,
  });

  return {
    promoted: true,
    benefit,
    previousVersion,
    versionRecord: {
      benefitId: benefit.id,
      previousVersion: previousVersion?.version ?? null,
      newVersion: benefit.version,
      promotedAt,
      reviewer: input.reviewer,
      notes: input.notes ?? null,
    },
    rollbackToken: rollbackToken(versionChange.benefitId, previousVersion?.version ?? 0),
  };
}

export function rollbackPromotion(input: {
  currentBenefit: CanonicalBenefitRecord;
  previousVersion: CanonicalBenefitRecord | null;
  reviewer: string;
  rolledBackAt?: string;
}) {
  if (!input.previousVersion) {
    return {
      rolledBack: false,
      benefit: null,
      reason: "No previous version available",
    };
  }
  return {
    rolledBack: true,
    benefit: {
      ...input.previousVersion,
      updatedAt: input.rolledBackAt || new Date().toISOString(),
    },
    reason: `Rolled back ${input.currentBenefit.id} by ${input.reviewer}`,
  };
}

function rollbackToken(benefitId: string, previousVersion: number) {
  return `${benefitId}:rollback:${previousVersion}`;
}
