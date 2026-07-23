import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";
import type {
  BenefitChangeRecord,
  CandidateBenefit,
  ChangeType,
  RiskLevel,
} from "./benefitPipelineTypes";

type ComparableField = {
  field: keyof CanonicalBenefitRecord;
  changeType: ChangeType;
};

const COMPARABLE_FIELDS: ComparableField[] = [
  { field: "multiplier", changeType: "multiplier_changed" },
  { field: "specificMerchant", changeType: "merchant_changed" },
  { field: "specificMerchantIds", changeType: "merchant_changed" },
  { field: "statementCredit", changeType: "credit_amount_changed" },
  { field: "activationRequired", changeType: "activation_requirement_changed" },
  { field: "enrollmentRequired", changeType: "enrollment_requirement_changed" },
  { field: "effectiveDate", changeType: "effective_date_changed" },
  { field: "expirationDate", changeType: "expiration_changed" },
  { field: "redemptionLimitations", changeType: "restriction_changed" },
  { field: "exclusions", changeType: "restriction_changed" },
  { field: "label", changeType: "wording_only" },
  { field: "benefitDescription", changeType: "wording_only" },
  { field: "confidenceScore", changeType: "confidence_changed" },
  { field: "sourceUrl", changeType: "metadata_only" },
  { field: "sourceTitle", changeType: "metadata_only" },
];

export function compareCandidateToApproved(
  candidate: CandidateBenefit,
  approvedBenefits: CanonicalBenefitRecord[],
  detectedAt = new Date().toISOString(),
) {
  const existing = approvedBenefits.find(
    (benefit) => benefit.id === candidate.normalizedData.id,
  );
  if (!existing) {
    return {
      comparisonStatus: "new" as const,
      changes: [
        changeRecord({
          candidate,
          changeType: "new_benefit",
          field: "id",
          oldValue: null,
          newValue: candidate.normalizedData.id,
          detectedAt,
        }),
      ],
    };
  }

  const changes = COMPARABLE_FIELDS.flatMap((field) => {
    const oldValue = existing[field.field];
    const newValue = candidate.normalizedData[field.field];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return [];
    return [
      changeRecord({
        candidate,
        changeType:
          field.field === "statementCredit"
            ? statementCreditChangeType(oldValue, newValue)
            : field.changeType,
        field: String(field.field),
        oldValue,
        newValue,
        detectedAt,
      }),
    ];
  });

  return {
    comparisonStatus: changes.length ? ("changed" as const) : ("matched" as const),
    changes,
  };
}

export function detectRemovedBenefits(
  approvedBenefits: CanonicalBenefitRecord[],
  candidates: CandidateBenefit[],
  detectedAt = new Date().toISOString(),
) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.normalizedData.id));
  return approvedBenefits
    .filter((benefit) => !candidateIds.has(benefit.id))
    .map((benefit) =>
      changeRecord({
        candidate: {
          candidateId: `removed:${benefit.id}`,
          normalizedData: benefit,
        } as CandidateBenefit,
        changeType: "removed_benefit",
        field: "id",
        oldValue: benefit.id,
        newValue: null,
        detectedAt,
      }),
    );
}

export function classifyChangeRisk(changeType: ChangeType): RiskLevel {
  if (
    changeType === "removed_benefit" ||
    changeType === "new_benefit" ||
    changeType === "activation_requirement_changed" ||
    changeType === "enrollment_requirement_changed"
  ) {
    return "critical";
  }
  if (
    changeType === "merchant_changed" ||
    changeType === "multiplier_changed" ||
    changeType === "credit_amount_changed" ||
    changeType === "credit_frequency_changed" ||
    changeType === "expiration_changed"
  ) {
    return "high";
  }
  if (changeType === "restriction_changed" || changeType === "confidence_changed") {
    return "medium";
  }
  return "low";
}

function statementCreditChangeType(oldValue: unknown, newValue: unknown): ChangeType {
  const oldCredit = oldValue as { amountUSD?: number | null; period?: string | null } | null;
  const newCredit = newValue as { amountUSD?: number | null; period?: string | null } | null;
  if (oldCredit?.period !== newCredit?.period) return "credit_frequency_changed";
  return "credit_amount_changed";
}

function changeRecord(input: {
  candidate: CandidateBenefit;
  changeType: ChangeType;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  detectedAt: string;
}): BenefitChangeRecord {
  const severity = classifyChangeRisk(input.changeType);
  return {
    changeId: `${input.candidate.candidateId}:${input.field}:${input.changeType}`,
    candidateId: input.candidate.candidateId,
    benefitId: input.candidate.normalizedData.id,
    changeType: input.changeType,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.newValue,
    severity,
    reason: reasonFor(input.changeType, severity),
    detectedAt: input.detectedAt,
  };
}

function reasonFor(changeType: ChangeType, severity: RiskLevel) {
  return `${changeType} classified as ${severity} risk`;
}
