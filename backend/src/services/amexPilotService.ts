import fs from "fs";
import path from "path";
import { extractAmexHtmlSource } from "./amexHtmlBenefitExtractor";
import { compareCandidateToApproved, detectRemovedBenefits } from "./benefitComparisonService";
import { createCandidatesFromExtraction } from "./benefitExtractionService";
import { evaluateSourceHealth } from "./benefitHealthService";
import { promoteApprovedCandidate, rollbackPromotion } from "./benefitPromotionService";
import { createReviewRecord, decideCandidateReview } from "./benefitReviewService";
import { getBenefitSource } from "./benefitSourceRegistryService";
import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";
import type { BenefitPipelineLogger } from "./benefitPipelineLogger";
import { silentBenefitPipelineLogger } from "./benefitPipelineLogger";

const AMEX_SOURCE_ID = "src:amex-platinum:benefits";
const DEFAULT_NOW = "2026-07-22T00:00:00.000Z";

export function loadAmexPilotHtmlFixture(version: "v1" | "v2") {
  const file = path.resolve(
    process.cwd(),
    "fixtures",
    "amex",
    `platinum-benefits-${version}.html`,
  );
  return fs.readFileSync(file, "utf8");
}

export function extractAmexPilotFixture(
  version: "v1" | "v2" = "v2",
  now = DEFAULT_NOW,
  logger: BenefitPipelineLogger = silentBenefitPipelineLogger,
) {
  const source = requireAmexSource();
  logger({
    stage: "source",
    action: "amex_source_loaded",
    sourceId: source.sourceId,
    status: "succeeded",
    timestamp: now,
    metadata: { sourceUrl: source.sourceUrl, fixtureVersion: version },
  });

  const extraction = extractAmexHtmlSource({
    source,
    observedAt: now,
    fixturePayload: { html: loadAmexPilotHtmlFixture(version) },
  }, logger);
  const candidates = createCandidatesFromExtraction(extraction);

  logger({
    stage: "extraction",
    action: "amex_candidates_created",
    sourceId: source.sourceId,
    status: "succeeded",
    timestamp: now,
    metadata: { candidateCount: candidates.length },
  });

  return { source, extraction, candidates };
}

export function approvedAmexPilotBenefits(now = "2026-07-01T00:00:00.000Z") {
  return extractAmexPilotFixture("v1", now).candidates.map((candidate) => ({
    ...candidate.normalizedData,
    verificationStatus: "verified" as const,
    productionEligible: true,
    lastVerified: now,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }));
}

export function compareAmexPilotFixture(
  now = DEFAULT_NOW,
  logger: BenefitPipelineLogger = silentBenefitPipelineLogger,
) {
  const approvedBenefits = approvedAmexPilotBenefits();
  const extracted = extractAmexPilotFixture("v2", now, logger);
  const comparisons = extracted.candidates.map((candidate) => {
    const comparison = compareCandidateToApproved(candidate, approvedBenefits, now);
    logger({
      stage: "comparison",
      action: "amex_candidate_compared",
      sourceId: candidate.sourceId,
      candidateId: candidate.candidateId,
      benefitId: candidate.normalizedData.id,
      status: "succeeded",
      timestamp: now,
      metadata: {
        comparisonStatus: comparison.comparisonStatus,
        changeTypes: comparison.changes.map((change) => change.changeType),
      },
    });
    return { candidate, ...comparison };
  });
  const removedChanges = detectRemovedBenefits(approvedBenefits, extracted.candidates, now);
  const health = evaluateSourceHealth({
    source: extracted.source,
    checkedAt: now,
    extractionSucceeded: true,
    parserWarnings: extracted.extraction.warnings,
    checksumChanged: true,
  });

  logger({
    stage: "health",
    action: "amex_source_health_checked",
    sourceId: extracted.source.sourceId,
    status: "succeeded",
    timestamp: now,
    metadata: health,
  });

  return {
    ...extracted,
    approvedBenefits,
    comparisons,
    removedChanges,
    health,
  };
}

export function reviewAmexPilotFixture(
  now = DEFAULT_NOW,
  logger: BenefitPipelineLogger = silentBenefitPipelineLogger,
) {
  const comparison = compareAmexPilotFixture(now, logger);
  const reviews = comparison.comparisons.map((item) => {
    const review = createReviewRecord({
      candidate: item.candidate,
      changes: item.changes,
      now,
    });
    logger({
      stage: "review",
      action: "amex_review_created",
      sourceId: review.sourceId,
      candidateId: review.candidateId,
      status: review.status === "needs_review" ? "succeeded" : "skipped",
      timestamp: now,
      metadata: {
        reviewId: review.reviewId,
        changeCount: review.changeSummary.length,
      },
    });
    return review;
  });
  return { ...comparison, reviews };
}

export function promoteAmexPilotFixture(
  now = DEFAULT_NOW,
  logger: BenefitPipelineLogger = silentBenefitPipelineLogger,
) {
  const reviewDemo = reviewAmexPilotFixture(now, logger);
  const changed = reviewDemo.comparisons.find(
    (item) =>
      item.candidate.normalizedData.id ===
      "amex-platinum:merchant-credit:amex-platinum-lululemon-credit",
  );
  if (!changed) throw new Error("Expected Amex lululemon candidate was not extracted");
  const review = createReviewRecord({
    candidate: changed.candidate,
    changes: changed.changes,
    now,
  });
  const approvedReview = decideCandidateReview({
    review,
    decision: "approved",
    reviewer: "amex-pilot-reviewer",
    notes: "Approved Amex pilot fixture after source review",
    now,
  });
  const promotion = promoteApprovedCandidate({
    candidate: changed.candidate,
    review: approvedReview,
    approvedBenefits: reviewDemo.approvedBenefits,
    reviewer: "amex-pilot-reviewer",
    notes: approvedReview.notes,
    promotedAt: now,
  });

  logger({
    stage: "promotion",
    action: "amex_candidate_promoted",
    sourceId: changed.candidate.sourceId,
    candidateId: changed.candidate.candidateId,
    benefitId: changed.candidate.normalizedData.id,
    status: promotion.promoted ? "succeeded" : "failed",
    timestamp: now,
    metadata: {
      version: promotion.benefit?.version,
      rollbackToken: promotion.rollbackToken,
    },
  });

  return { ...reviewDemo, approvedReview, promotion };
}

export function rejectAmexPilotFixture(
  now = DEFAULT_NOW,
  logger: BenefitPipelineLogger = silentBenefitPipelineLogger,
) {
  const reviewDemo = reviewAmexPilotFixture(now, logger);
  const changed = reviewDemo.comparisons[0];
  const review = createReviewRecord({
    candidate: changed.candidate,
    changes: changed.changes,
    now,
  });
  const rejectedReview = decideCandidateReview({
    review,
    decision: "rejected",
    reviewer: "amex-pilot-reviewer",
    notes: "Rejected Amex pilot fixture",
    now,
  });
  const promotion = promoteApprovedCandidate({
    candidate: changed.candidate,
    review: rejectedReview,
    approvedBenefits: reviewDemo.approvedBenefits,
    reviewer: "amex-pilot-reviewer",
    promotedAt: now,
  });
  logger({
    stage: "review",
    action: "amex_candidate_rejected",
    sourceId: changed.candidate.sourceId,
    candidateId: changed.candidate.candidateId,
    status: "succeeded",
    timestamp: now,
    metadata: { promoted: promotion.promoted },
  });
  return { ...reviewDemo, rejectedReview, promotion };
}

export function rollbackAmexPilotFixture(
  now = DEFAULT_NOW,
  logger: BenefitPipelineLogger = silentBenefitPipelineLogger,
) {
  const promoted = promoteAmexPilotFixture(now, logger);
  const rollback = rollbackPromotion({
    currentBenefit: promoted.promotion.benefit as CanonicalBenefitRecord,
    previousVersion: promoted.promotion.previousVersion,
    reviewer: "amex-pilot-reviewer",
    rolledBackAt: now,
  });
  logger({
    stage: "rollback",
    action: "amex_promotion_rolled_back",
    benefitId: promoted.promotion.benefit?.id,
    status: rollback.rolledBack ? "succeeded" : "failed",
    timestamp: now,
    metadata: { restoredVersion: rollback.benefit?.version },
  });
  return { ...promoted, rollback };
}

export function amexPilotCardFromBenefits(benefits: CanonicalBenefitRecord[]) {
  return {
    slug: "amex-platinum",
    name: "The Platinum Card from American Express",
    issuer: "American Express",
    annualFee: 695,
    productionEligible: true,
    benefitsDetail: {
      sourceUrl: requireAmexSource().sourceUrl,
      sourceType: "issuer_official",
      lastVerified: latestVerified(benefits),
      productionEligible: true,
      confidence: 0.95,
      merchantCredits: benefits
        .filter((benefit) => benefit.sourceKind === "merchant_credit")
        .map((benefit) => ({
          id: benefit.id,
          label: benefit.label,
          amountUSD: benefit.statementCredit?.amountUSD,
          period: benefit.statementCredit?.period,
          capPerPeriodUSD: benefit.statementCredit?.capPerPeriodUSD,
          requiresEnrollment: benefit.enrollmentRequired,
          expiresAt: benefit.expirationDate,
          sourceUrl: benefit.sourceUrl,
          sourceType: benefit.sourceType,
          eligibleWhen: {
            merchantPatterns: [
              benefit.specificMerchant,
              ...benefit.specificMerchantIds,
            ].filter(Boolean),
            channels: benefit.eligiblePurchaseChannels,
          },
        })),
      rewardsByCategory: benefits
        .filter((benefit) => benefit.sourceKind === "reward_category")
        .map((benefit) => ({
          keys: [benefit.merchantCategory].filter(Boolean),
          rate: `${benefit.multiplier}x`,
          unit: benefit.rewardMechanism === "miles" ? "miles" : "points",
          confidence: benefit.confidenceScore,
          eligibleWhen: { channels: benefit.eligiblePurchaseChannels },
        })),
      perks: benefits
        .filter((benefit) => !["merchant_credit", "reward_category"].includes(benefit.sourceKind))
        .map((benefit) => benefit.label),
    },
  };
}

function requireAmexSource() {
  const source = getBenefitSource(AMEX_SOURCE_ID);
  if (!source) throw new Error(`Missing Amex pilot source ${AMEX_SOURCE_ID}`);
  return source;
}

function latestVerified(benefits: CanonicalBenefitRecord[]) {
  const verified = benefits
    .map((benefit) => benefit.lastVerified)
    .filter(Boolean)
    .sort();
  return verified[verified.length - 1] || null;
}
