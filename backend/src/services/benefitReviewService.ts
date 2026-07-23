import type {
  BenefitChangeRecord,
  BenefitReviewRecord,
  CandidateBenefit,
  ReviewDecision,
} from "./benefitPipelineTypes";

export function createReviewRecord(input: {
  candidate: CandidateBenefit;
  changes: BenefitChangeRecord[];
  now?: string;
}): BenefitReviewRecord {
  const now = input.now || new Date().toISOString();
  return {
    reviewId: `review:${input.candidate.candidateId}`,
    candidateId: input.candidate.candidateId,
    sourceId: input.candidate.sourceId,
    status: input.changes.length ? "needs_review" : "pending",
    reviewer: null,
    reviewedAt: null,
    notes: null,
    decision: null,
    changeSummary: input.changes,
    createdAt: now,
    updatedAt: now,
  };
}

export function decideCandidateReview(input: {
  review: BenefitReviewRecord;
  decision: ReviewDecision;
  reviewer: string;
  notes?: string | null;
  now?: string;
}): BenefitReviewRecord {
  const now = input.now || new Date().toISOString();
  return {
    ...input.review,
    status: input.decision === "approved" ? "approved" : "rejected",
    reviewer: input.reviewer,
    reviewedAt: now,
    notes: input.notes ?? null,
    decision: input.decision,
    updatedAt: now,
  };
}

export function queueCandidatesForReview(
  candidates: CandidateBenefit[],
  changesByCandidateId: Record<string, BenefitChangeRecord[]>,
  now = new Date().toISOString(),
) {
  return candidates.map((candidate) =>
    createReviewRecord({
      candidate,
      changes: changesByCandidateId[candidate.candidateId] || [],
      now,
    }),
  );
}
