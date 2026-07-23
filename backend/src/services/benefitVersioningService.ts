import type {
  BenefitChangeType,
  BenefitVersionRecord,
  CanonicalBenefitRecord,
} from "./benefitIntelligenceService";
import { buildBenefitVersionRecord } from "./benefitIntelligenceService";

export function createBenefitVersionChange(input: {
  previousValue: CanonicalBenefitRecord | null;
  newValue: CanonicalBenefitRecord;
  changeSource: string;
  changeType?: BenefitChangeType;
  changedAt?: string;
}): BenefitVersionRecord {
  return buildBenefitVersionRecord({
    previousValue: input.previousValue,
    newValue: {
      ...input.newValue,
      version: input.previousValue ? input.previousValue.version + 1 : 1,
    },
    changeSource: input.changeSource,
    changeType:
      input.changeType ||
      inferChangeType(input.previousValue, input.newValue),
    changedAt: input.changedAt,
  });
}

export function diffBenefitRecord(
  previousValue: CanonicalBenefitRecord,
  newValue: CanonicalBenefitRecord,
) {
  const changedFields: string[] = [];
  for (const key of Object.keys(newValue) as Array<keyof CanonicalBenefitRecord>) {
    if (JSON.stringify(previousValue[key]) !== JSON.stringify(newValue[key])) {
      changedFields.push(String(key));
    }
  }
  return changedFields;
}

function inferChangeType(
  previousValue: CanonicalBenefitRecord | null,
  newValue: CanonicalBenefitRecord,
): BenefitChangeType {
  if (!previousValue) return "created";
  if (previousValue.expirationDate !== newValue.expirationDate) return "expired";
  if (previousValue.sourceUrl !== newValue.sourceUrl) return "source_changed";
  if (previousValue.verificationStatus !== newValue.verificationStatus) {
    return "verification_changed";
  }
  if (previousValue.productionEligible !== newValue.productionEligible) {
    return "eligibility_changed";
  }
  return "updated";
}
