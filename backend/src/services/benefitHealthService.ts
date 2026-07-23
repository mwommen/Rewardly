import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";
import type {
  BenefitSourceRecord,
  SourceHealthCheck,
  StalenessAlert,
  StalenessLevel,
} from "./benefitPipelineTypes";

export function evaluateSourceHealth(input: {
  source: BenefitSourceRecord;
  checkedAt?: string;
  extractionSucceeded?: boolean;
  parserWarnings?: string[];
  sourceUnavailable?: boolean;
  checksumChanged?: boolean;
}): SourceHealthCheck {
  const checkedAt = input.checkedAt || new Date().toISOString();
  if (input.source.status === "deprecated") {
    return {
      sourceId: input.source.sourceId,
      status: "deprecated",
      checkedAt,
      reason: "Source is deprecated",
    };
  }
  if (input.sourceUnavailable) {
    return {
      sourceId: input.source.sourceId,
      status: "failed",
      checkedAt,
      reason: "Source unavailable",
    };
  }
  if (input.extractionSucceeded === false) {
    return {
      sourceId: input.source.sourceId,
      status: "failed",
      checkedAt,
      reason: "Extraction failed",
    };
  }
  if ((input.parserWarnings || []).length || input.checksumChanged) {
    return {
      sourceId: input.source.sourceId,
      status: "warning",
      checkedAt,
      reason: input.checksumChanged
        ? "Source checksum changed"
        : "Parser warnings present",
    };
  }
  return {
    sourceId: input.source.sourceId,
    status: "healthy",
    checkedAt,
    reason: "Source extracted successfully",
  };
}

export function evaluateBenefitStaleness(
  benefits: CanonicalBenefitRecord[],
  now = new Date(),
): StalenessAlert[] {
  return benefits.map((benefit) => {
    const ageDays = ageInDays(benefit.lastVerified, now);
    const level = stalenessLevel(ageDays);
    return {
      benefitId: benefit.id,
      cardSlug: benefit.cardSlug,
      level,
      ageDays,
      reason: reasonFor(level, ageDays),
    };
  });
}

function ageInDays(date: string | null | undefined, now: Date) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
}

function stalenessLevel(ageDays: number | null): StalenessLevel {
  if (ageDays === null) return "high_priority";
  if (ageDays >= 180) return "high_priority";
  if (ageDays >= 90) return "production_warning";
  if (ageDays >= 60) return "review_recommended";
  if (ageDays >= 30) return "warning";
  return "fresh";
}

function reasonFor(level: StalenessLevel, ageDays: number | null) {
  if (ageDays === null) return "Benefit has no verification timestamp";
  return `${level} after ${ageDays} days since verification`;
}
