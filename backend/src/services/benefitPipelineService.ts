import { compareCandidateToApproved, detectRemovedBenefits } from "./benefitComparisonService";
import { extractSource, createCandidatesFromExtraction } from "./benefitExtractionService";
import { evaluateBenefitStaleness, evaluateSourceHealth } from "./benefitHealthService";
import { promoteApprovedCandidate, rollbackPromotion } from "./benefitPromotionService";
import { createReviewRecord, decideCandidateReview } from "./benefitReviewService";
import {
  fixtureApprovedBenefit,
  fixtureExtractionPayload,
  fixtureSource,
} from "./benefitPipelineFixture";
import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";

export function runBenefitPipelineFixture(now = "2026-07-22T00:00:00.000Z") {
  const source = fixtureSource();
  const extraction = extractSource({
    source,
    observedAt: now,
    fixturePayload: fixtureExtractionPayload(),
  });
  const candidates = createCandidatesFromExtraction(extraction);
  const approvedBenefits = [fixtureApprovedBenefit];
  const comparisons = candidates.map((candidate) => ({
    candidate,
    ...compareCandidateToApproved(candidate, approvedBenefits, now),
  }));
  const removedChanges = detectRemovedBenefits(approvedBenefits, candidates, now);
  const reviews = comparisons.map((comparison) =>
    createReviewRecord({
      candidate: comparison.candidate,
      changes: comparison.changes,
      now,
    }),
  );
  const health = evaluateSourceHealth({
    source,
    checkedAt: now,
    extractionSucceeded: true,
    parserWarnings: extraction.warnings,
    checksumChanged: true,
  });
  const staleness = evaluateBenefitStaleness(
    approvedBenefits,
    new Date(now),
  );

  return {
    source,
    extraction,
    candidates,
    comparisons,
    removedChanges,
    reviews,
    health,
    staleness,
    approvedBenefits,
  };
}

export function approveAndPromoteFixture(now = "2026-07-22T00:00:00.000Z") {
  const pipeline = runBenefitPipelineFixture(now);
  const candidate = pipeline.candidates[0];
  const review = decideCandidateReview({
    review: pipeline.reviews[0],
    decision: "approved",
    reviewer: "fixture-reviewer",
    notes: "Fixture approval for pipeline test",
    now,
  });
  const promotion = promoteApprovedCandidate({
    candidate,
    review,
    approvedBenefits: pipeline.approvedBenefits,
    reviewer: "fixture-reviewer",
    notes: review.notes,
    promotedAt: now,
  });
  return { ...pipeline, approvedReview: review, promotion };
}

export function rejectFixtureCandidate(now = "2026-07-22T00:00:00.000Z") {
  const pipeline = runBenefitPipelineFixture(now);
  const rejectedReview = decideCandidateReview({
    review: pipeline.reviews[0],
    decision: "rejected",
    reviewer: "fixture-reviewer",
    notes: "Rejected fixture candidate",
    now,
  });
  const promotion = promoteApprovedCandidate({
    candidate: pipeline.candidates[0],
    review: rejectedReview,
    approvedBenefits: pipeline.approvedBenefits,
    reviewer: "fixture-reviewer",
    promotedAt: now,
  });
  return { ...pipeline, rejectedReview, promotion };
}

export function rollbackFixturePromotion(now = "2026-07-22T00:00:00.000Z") {
  const promoted = approveAndPromoteFixture(now);
  const rollback = rollbackPromotion({
    currentBenefit: promoted.promotion.benefit as CanonicalBenefitRecord,
    previousVersion: promoted.promotion.previousVersion,
    reviewer: "fixture-reviewer",
    rolledBackAt: now,
  });
  return { ...promoted, rollback };
}
