import {
  compareCandidateToApproved,
  detectRemovedBenefits,
} from "../src/services/benefitComparisonService";
import {
  createCandidatesFromExtraction,
  extractSource,
} from "../src/services/benefitExtractionService";
import {
  evaluateBenefitStaleness,
  evaluateSourceHealth,
} from "../src/services/benefitHealthService";
import {
  approveAndPromoteFixture,
  rejectFixtureCandidate,
  rollbackFixturePromotion,
  runBenefitPipelineFixture,
} from "../src/services/benefitPipelineService";
import {
  fixtureApprovedBenefit,
  fixtureChangedBenefit,
  fixtureExtractionPayload,
  fixtureSource,
} from "../src/services/benefitPipelineFixture";
import {
  createReviewRecord,
  decideCandidateReview,
} from "../src/services/benefitReviewService";
import { listBenefitSources } from "../src/services/benefitSourceRegistryService";

describe("benefit intelligence pipeline", () => {
  test("source registry lists official source metadata", () => {
    expect(listBenefitSources()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "src:amex-platinum:benefits",
          sourceType: "issuer_benefit_page",
          parserStrategy: "html",
          healthStatus: "unknown",
        }),
      ]),
    );
  });

  test("extractors create candidates and never production benefits", () => {
    const extraction = extractSource({
      source: fixtureSource(),
      observedAt: "2026-07-22T00:00:00.000Z",
      fixturePayload: fixtureExtractionPayload(),
    });
    const candidates = createCandidatesFromExtraction(extraction);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual(
      expect.objectContaining({
        reviewStatus: "pending",
        comparisonStatus: "new",
        parserConfidence: 0.88,
      }),
    );
    expect(candidates[0].normalizedData).toEqual(
      expect.objectContaining({
        verificationStatus: "automatically_extracted",
        productionEligible: false,
        lastVerified: null,
      }),
    );
  });

  test("comparison detects updated credit amount and classifies risk", () => {
    const candidate = createCandidatesFromExtraction(
      extractSource({
        source: fixtureSource(),
        observedAt: "2026-07-22T00:00:00.000Z",
        fixturePayload: fixtureExtractionPayload(),
      }),
    )[0];

    const comparison = compareCandidateToApproved(candidate, [
      fixtureApprovedBenefit,
    ]);

    expect(comparison.comparisonStatus).toBe("changed");
    expect(comparison.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeType: "credit_amount_changed",
          severity: "high",
          field: "statementCredit",
        }),
      ]),
    );
  });

  test("comparison detects new candidate and removed production benefits", () => {
    const candidate = createCandidatesFromExtraction(
      extractSource({
        source: fixtureSource(),
        observedAt: "2026-07-22T00:00:00.000Z",
        fixturePayload: {
          benefits: [{ ...fixtureChangedBenefit, id: "new:benefit" }],
        },
      }),
    )[0];

    expect(compareCandidateToApproved(candidate, []).changes[0]).toEqual(
      expect.objectContaining({
        changeType: "new_benefit",
        severity: "critical",
      }),
    );
    expect(detectRemovedBenefits([fixtureApprovedBenefit], [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeType: "removed_benefit",
          severity: "critical",
        }),
      ]),
    );
  });

  test("minor wording is low risk and metadata-only changes are low risk", () => {
    const candidate = createCandidatesFromExtraction(
      extractSource({
        source: fixtureSource(),
        observedAt: "2026-07-22T00:00:00.000Z",
        fixturePayload: {
          benefits: [
            {
              ...fixtureApprovedBenefit,
              label: "Updated wording for lululemon credit",
              sourceUrl: "https://issuer.example/new-source",
            },
          ],
        },
      }),
    )[0];

    const comparison = compareCandidateToApproved(candidate, [
      fixtureApprovedBenefit,
    ]);

    expect(comparison.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ changeType: "wording_only", severity: "low" }),
        expect.objectContaining({ changeType: "metadata_only", severity: "low" }),
      ]),
    );
  });

  test("review approval and rejection control promotion", () => {
    const pipeline = runBenefitPipelineFixture();
    const review = createReviewRecord({
      candidate: pipeline.candidates[0],
      changes: pipeline.comparisons[0].changes,
      now: "2026-07-22T00:00:00.000Z",
    });

    const approved = decideCandidateReview({
      review,
      decision: "approved",
      reviewer: "reviewer@example.com",
      notes: "Approved after source review",
      now: "2026-07-22T00:00:00.000Z",
    });
    expect(approved.status).toBe("approved");

    const rejected = rejectFixtureCandidate();
    expect(rejected.promotion.promoted).toBe(false);
  });

  test("promotion creates a new version and rollback restores previous version", () => {
    const promoted = approveAndPromoteFixture("2026-07-22T00:00:00.000Z");

    expect(promoted.promotion).toEqual(
      expect.objectContaining({
        promoted: true,
        rollbackToken:
          "amex-platinum:merchant-credit:amex-platinum-lululemon-credit:rollback:1",
      }),
    );
    expect(promoted.promotion.benefit).toEqual(
      expect.objectContaining({
        productionEligible: true,
        verificationStatus: "verified",
        version: 2,
      }),
    );

    const rolledBack = rollbackFixturePromotion("2026-07-22T00:00:00.000Z");
    expect(rolledBack.rollback).toEqual(
      expect.objectContaining({
        rolledBack: true,
        benefit: expect.objectContaining({ version: 1 }),
      }),
    );
  });

  test("source health detects parser failure and unavailable sources", () => {
    const source = fixtureSource();

    expect(
      evaluateSourceHealth({
        source,
        extractionSucceeded: false,
        checkedAt: "2026-07-22T00:00:00.000Z",
      }),
    ).toEqual(expect.objectContaining({ status: "failed" }));

    expect(
      evaluateSourceHealth({
        source,
        sourceUnavailable: true,
        checkedAt: "2026-07-22T00:00:00.000Z",
      }),
    ).toEqual(expect.objectContaining({ status: "failed" }));
  });

  test("staleness detection escalates by age without disabling benefits", () => {
    const alerts = evaluateBenefitStaleness(
      [
        { ...fixtureApprovedBenefit, id: "fresh", lastVerified: "2026-07-10T00:00:00.000Z" },
        { ...fixtureApprovedBenefit, id: "warning", lastVerified: "2026-06-01T00:00:00.000Z" },
        { ...fixtureApprovedBenefit, id: "review", lastVerified: "2026-05-01T00:00:00.000Z" },
        { ...fixtureApprovedBenefit, id: "prod", lastVerified: "2026-03-01T00:00:00.000Z" },
        { ...fixtureApprovedBenefit, id: "high", lastVerified: "2025-12-01T00:00:00.000Z" },
      ],
      new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(alerts.map((alert) => alert.level)).toEqual([
      "fresh",
      "warning",
      "review_recommended",
      "production_warning",
      "high_priority",
    ]);
  });

  test("candidate under review does not mutate approved production benefit", () => {
    const pipeline = runBenefitPipelineFixture();

    expect(pipeline.approvedBenefits[0].statementCredit?.amountUSD).toBe(75);
    expect(pipeline.candidates[0].normalizedData.statementCredit?.amountUSD).toBe(100);
    expect(pipeline.approvedBenefits[0].productionEligible).toBe(true);
    expect(pipeline.candidates[0].normalizedData.productionEligible).toBe(false);
  });
});
