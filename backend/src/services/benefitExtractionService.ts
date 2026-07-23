import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";
import type {
  BenefitSourceRecord,
  CandidateBenefit,
  ExtractorInput,
  ExtractorResult,
  ParserStrategy,
} from "./benefitPipelineTypes";
import { extractAmexHtmlSource } from "./amexHtmlBenefitExtractor";

type Extractor = (input: ExtractorInput) => ExtractorResult;

const EXTRACTORS: Record<ParserStrategy, Extractor> = {
  html: fixtureExtractor,
  pdf: fixtureExtractor,
  structured_json: fixtureExtractor,
  llm_assisted: fixtureExtractor,
  manual_upload: fixtureExtractor,
};

export function extractSource(input: ExtractorInput): ExtractorResult {
  if (
    input.source.issuer === "American Express" &&
    input.source.parserStrategy === "html" &&
    hasHtmlPayload(input.fixturePayload)
  ) {
    return extractAmexHtmlSource(input);
  }
  const extractor = EXTRACTORS[input.source.parserStrategy];
  return extractor(input);
}

export function createCandidatesFromExtraction(
  result: ExtractorResult,
): CandidateBenefit[] {
  return result.normalizedBenefits.map((benefit, index) => ({
    candidateId: candidateId(result.sourceId, benefit.id, result.observedAt, index),
    sourceId: result.sourceId,
    observedAt: result.observedAt,
    rawExtractedData: result.rawExtractedData,
    normalizedData: {
      ...benefit,
      verificationStatus: "automatically_extracted",
      productionEligible: false,
      lastObservedAt: result.observedAt,
      lastVerified: null,
    },
    parserConfidence: result.parserConfidence,
    warnings: result.warnings,
    unsupportedFields: result.unsupportedFields,
    missingFields: result.missingFields,
    comparisonStatus: "new",
    reviewStatus: "pending",
    createdAt: result.observedAt,
  }));
}

function fixtureExtractor(input: ExtractorInput): ExtractorResult {
  const observedAt = input.observedAt || new Date().toISOString();
  const payload = normalizeFixturePayload(input.source, input.fixturePayload, observedAt);
  return {
    sourceId: input.source.sourceId,
    observedAt,
    rawExtractedData: input.fixturePayload || { fixture: true },
    normalizedBenefits: payload.benefits,
    parserConfidence: payload.parserConfidence,
    warnings: payload.warnings,
    unsupportedFields: payload.unsupportedFields,
    missingFields: payload.missingFields,
  };
}

function normalizeFixturePayload(
  source: BenefitSourceRecord,
  fixturePayload: unknown,
  observedAt: string,
) {
  const payload = fixturePayload as
    | {
        benefits?: CanonicalBenefitRecord[];
        parserConfidence?: number;
        warnings?: string[];
        unsupportedFields?: string[];
        missingFields?: string[];
      }
    | undefined;
  const benefits = (payload?.benefits || []).map((benefit) =>
    normalizeCandidateBenefit(source, benefit, observedAt),
  );
  return {
    benefits,
    parserConfidence: payload?.parserConfidence ?? 0.72,
    warnings: payload?.warnings || [],
    unsupportedFields: payload?.unsupportedFields || [],
    missingFields: payload?.missingFields || [],
  };
}

function hasHtmlPayload(payload: unknown) {
  return (
    typeof payload === "string" ||
    Boolean(
      payload &&
        typeof payload === "object" &&
        typeof (payload as { html?: unknown }).html === "string",
    )
  );
}

function normalizeCandidateBenefit(
  source: BenefitSourceRecord,
  benefit: CanonicalBenefitRecord,
  observedAt: string,
): CanonicalBenefitRecord {
  return {
    ...benefit,
    cardSlug: benefit.cardSlug || source.cardSlug,
    cardIssuer: benefit.cardIssuer || source.issuer,
    sourceUrl: benefit.sourceUrl || source.sourceUrl,
    sourceType:
      source.sourceType === "issuer_terms" ? "issuer_terms" : "issuer_official",
    lastObservedAt: observedAt,
    lastVerified: null,
    verificationStatus: "automatically_extracted",
    productionEligible: false,
    updatedAt: observedAt,
  };
}

function candidateId(
  sourceId: string,
  benefitId: string,
  observedAt: string,
  index: number,
) {
  return [sourceId, benefitId, observedAt, index]
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
