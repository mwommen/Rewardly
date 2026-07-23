import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";

export type OfficialSourceType =
  | "issuer_benefit_page"
  | "issuer_reward_page"
  | "issuer_terms"
  | "pdf_benefit_guide"
  | "issuer_faq"
  | "official_merchant_benefit_page";

export type ParserStrategy =
  | "html"
  | "pdf"
  | "structured_json"
  | "llm_assisted"
  | "manual_upload";

export type SourceStatus = "active" | "paused" | "deprecated";
export type SourceHealthStatus = "healthy" | "warning" | "failed" | "deprecated" | "unknown";
export type ExpectedUpdateFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "unknown";

export type BenefitSourceRecord = {
  sourceId: string;
  cardSlug: string;
  issuer: string;
  sourceUrl: string;
  sourceType: OfficialSourceType;
  priority: number;
  expectedUpdateFrequency: ExpectedUpdateFrequency;
  parserStrategy: ParserStrategy;
  status: SourceStatus;
  firstDiscoveredAt: string;
  lastCheckedAt: string | null;
  lastSuccessfulExtractionAt: string | null;
  lastObservedChangeAt: string | null;
  checksum: string | null;
  healthStatus: SourceHealthStatus;
};

export type ExtractorInput = {
  source: BenefitSourceRecord;
  observedAt?: string;
  fixturePayload?: unknown;
};

export type ExtractorResult = {
  sourceId: string;
  observedAt: string;
  rawExtractedData: unknown;
  normalizedBenefits: CanonicalBenefitRecord[];
  parserConfidence: number;
  warnings: string[];
  unsupportedFields: string[];
  missingFields: string[];
};

export type ComparisonStatus = "new" | "matched" | "changed" | "removed" | "duplicate" | "error";
export type ReviewStatus = "pending" | "needs_review" | "approved" | "rejected";

export type CandidateBenefit = {
  candidateId: string;
  sourceId: string;
  observedAt: string;
  rawExtractedData: unknown;
  normalizedData: CanonicalBenefitRecord;
  parserConfidence: number;
  warnings: string[];
  unsupportedFields: string[];
  missingFields: string[];
  comparisonStatus: ComparisonStatus;
  reviewStatus: ReviewStatus;
  createdAt: string;
};

export type ChangeType =
  | "new_benefit"
  | "removed_benefit"
  | "multiplier_changed"
  | "merchant_changed"
  | "credit_amount_changed"
  | "credit_frequency_changed"
  | "activation_requirement_changed"
  | "enrollment_requirement_changed"
  | "effective_date_changed"
  | "expiration_changed"
  | "restriction_changed"
  | "wording_only"
  | "metadata_only"
  | "confidence_changed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type BenefitChangeRecord = {
  changeId: string;
  candidateId: string;
  benefitId: string;
  changeType: ChangeType;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  severity: RiskLevel;
  reason: string;
  detectedAt: string;
};

export type ReviewDecision = "approved" | "rejected";

export type BenefitReviewRecord = {
  reviewId: string;
  candidateId: string;
  sourceId: string;
  status: ReviewStatus;
  reviewer: string | null;
  reviewedAt: string | null;
  notes: string | null;
  decision: ReviewDecision | null;
  changeSummary: BenefitChangeRecord[];
  createdAt: string;
  updatedAt: string;
};

export type PromotionResult = {
  promoted: boolean;
  benefit: CanonicalBenefitRecord | null;
  previousVersion: CanonicalBenefitRecord | null;
  versionRecord: {
    benefitId: string;
    previousVersion: number | null;
    newVersion: number;
    promotedAt: string;
    reviewer: string;
    notes: string | null;
  } | null;
  rollbackToken: string | null;
};

export type SourceHealthCheck = {
  sourceId: string;
  status: SourceHealthStatus;
  checkedAt: string;
  reason: string;
};

export type StalenessLevel = "fresh" | "warning" | "review_recommended" | "production_warning" | "high_priority";

export type StalenessAlert = {
  benefitId: string;
  cardSlug: string;
  level: StalenessLevel;
  ageDays: number | null;
  reason: string;
};
