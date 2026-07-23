jest.mock("../src/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("../src/utils/category", () => ({
  inferCategories: jest.fn(),
}));

jest.mock("../src/utils/valuation", () => ({
  toCashEquivalent: jest.fn(
    (unit: "cash" | "points" | "miles", rate: number, issuer: string) => {
      if (unit === "cash") return rate / 100;
      return /american express|amex/i.test(issuer) ? rate * 0.015 : rate * 0.01;
    },
  ),
}));

import { getDb } from "../src/db";
import {
  approvedAmexPilotBenefits,
  amexPilotCardFromBenefits,
  compareAmexPilotFixture,
  extractAmexPilotFixture,
  promoteAmexPilotFixture,
  rejectAmexPilotFixture,
  reviewAmexPilotFixture,
  rollbackAmexPilotFixture,
} from "../src/services/amexPilotService";
import { createInMemoryBenefitPipelineLogger } from "../src/services/benefitPipelineLogger";
import { listBenefitSources } from "../src/services/benefitSourceRegistryService";
import { recommendBestCards } from "../src/services/recommendationService";
import { canonicalizeWalletBenefitState } from "../src/services/walletIntelligenceService";
import { inferCategories } from "../src/utils/category";

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockedInferCategories = inferCategories as jest.MockedFunction<typeof inferCategories>;
const LULULEMON_BENEFIT_ID =
  "amex-platinum:merchant-credit:amex-platinum-lululemon-credit";
const CANONICALIZED_LULULEMON_BENEFIT_ID =
  "amex-platinum:merchant-credit:amex-platinum-merchant-credit-amex-platinum-lululemon-credit";

function makeDb(cards: any[]) {
  return {
    collection: () => ({
      find: () => ({ toArray: async () => cards }),
    }),
  } as any;
}

describe("American Express pilot integration", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    jest.clearAllMocks();
    mockedInferCategories.mockReturnValue(["apparel"]);
  });

  afterEach(() => jest.useRealTimers());

  test("source registry contains official Amex source definitions", () => {
    expect(listBenefitSources()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "src:amex-platinum:benefits",
          sourceType: "issuer_benefit_page",
          parserStrategy: "html",
        }),
        expect.objectContaining({
          sourceId: "src:amex-platinum:benefit-guide",
          sourceType: "pdf_benefit_guide",
          parserStrategy: "pdf",
        }),
        expect.objectContaining({
          sourceId: "src:amex-membership-rewards:info",
          sourceType: "issuer_reward_page",
        }),
      ]),
    );
  });

  test("HTML fixture extracts and normalizes candidate benefits", () => {
    const memory = createInMemoryBenefitPipelineLogger();
    const extracted = extractAmexPilotFixture("v2", undefined, memory.logger);

    expect(extracted.extraction.normalizedBenefits).toHaveLength(3);
    expect(extracted.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedData: expect.objectContaining({
            id: "amex-platinum:merchant-credit:amex-platinum-lululemon-credit",
            cardIssuer: "American Express",
            statementCredit: expect.objectContaining({ amountUSD: 100 }),
            productionEligible: false,
            verificationStatus: "automatically_extracted",
            lastVerified: null,
          }),
        }),
      ]),
    );
    expect(memory.events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "amex_source_loaded",
        "amex_html_extract",
        "amex_html_normalize",
        "amex_candidates_created",
      ]),
    );
  });

  test("comparison detects multiplier, credit, merchant, expiration, restriction, new, and removed changes", () => {
    const comparison = compareAmexPilotFixture();
    const changeTypes = [
      ...comparison.comparisons.flatMap((item) =>
        item.changes.map((change) => change.changeType),
      ),
      ...comparison.removedChanges.map((change) => change.changeType),
    ];

    expect(changeTypes).toEqual(expect.arrayContaining(["credit_amount_changed"]));
    expect(changeTypes).toEqual(expect.arrayContaining(["merchant_changed"]));
    expect(changeTypes).toEqual(expect.arrayContaining(["expiration_changed"]));
    expect(changeTypes).toEqual(expect.arrayContaining(["restriction_changed"]));
    expect(changeTypes).toEqual(expect.arrayContaining(["multiplier_changed"]));
    expect(changeTypes).toEqual(expect.arrayContaining(["new_benefit"]));
    expect(changeTypes).toEqual(expect.arrayContaining(["removed_benefit"]));
    expect(
      comparison.comparisons
        .flatMap((item) => item.changes)
        .some((change) => change.severity === "high"),
    ).toBe(true);
    expect(comparison.health.status).toBe("warning");
  });

  test("review simulation creates approvals and rejection does not promote", () => {
    const review = reviewAmexPilotFixture();
    expect(review.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "needs_review",
          changeSummary: expect.any(Array),
        }),
      ]),
    );

    const rejected = rejectAmexPilotFixture();
    expect(rejected.rejectedReview.status).toBe("rejected");
    expect(rejected.promotion.promoted).toBe(false);
    expect(rejected.approvedBenefits[0].statementCredit?.amountUSD).toBe(75);
  });

  test("approval promotes version 2 and rollback restores version 1 while preserving version history", () => {
    const promoted = promoteAmexPilotFixture();

    expect(promoted.approvedReview.status).toBe("approved");
    expect(promoted.promotion).toEqual(
      expect.objectContaining({
        promoted: true,
        previousVersion: expect.objectContaining({ version: 1 }),
        benefit: expect.objectContaining({
          version: 2,
          productionEligible: true,
          verificationStatus: "verified",
          statementCredit: expect.objectContaining({ amountUSD: 100 }),
        }),
        versionRecord: expect.objectContaining({
          previousVersion: 1,
          newVersion: 2,
        }),
      }),
    );

    const rolledBack = rollbackAmexPilotFixture();
    expect(rolledBack.rollback).toEqual(
      expect.objectContaining({
        rolledBack: true,
        benefit: expect.objectContaining({
          version: 1,
          statementCredit: expect.objectContaining({ amountUSD: 75 }),
        }),
      }),
    );
    expect(rolledBack.promotion.versionRecord).toEqual(
      expect.objectContaining({ previousVersion: 1, newVersion: 2 }),
    );
  });

  test("production recommendation stays on approved data before review approval", async () => {
    const approvedBenefits = approvedAmexPilotBenefits();
    const pendingCandidate = extractAmexPilotFixture("v2").candidates[0].normalizedData;
    mockedGetDb.mockResolvedValueOnce(makeDb([amexPilotCardFromBenefits(approvedBenefits)]));

    const out = await recommendBestCards({
      merchant: "lululemon",
      amount: 80,
      allowedCardSlugs: ["amex-platinum"],
      scoringMode: "strict_production",
      purchaseChannel: "online",
      enrolledBenefitIds: [pendingCandidate.id, CANONICALIZED_LULULEMON_BENEFIT_ID],
      walletBenefitStates: [
        canonicalizeWalletBenefitState({
          userId: "u1",
          cardSlug: "amex-platinum",
          benefitId: CANONICALIZED_LULULEMON_BENEFIT_ID,
          enrollmentStatus: "enrolled",
          activationStatus: "not_required",
          remainingValue: 75,
          cycleValueLimit: 75,
          cycleFrequency: "quarterly",
          confidenceSource: "user_verified",
        }),
      ],
    });

    expect(pendingCandidate.statementCredit?.amountUSD).toBe(100);
    expect(out.recommendations[0]).toEqual(
      expect.objectContaining({
        slug: "amex-platinum",
        estValueUSD: 75,
        matchedBenefit: "$75 statement credit at lululemon each quarter",
      }),
    );
  });

  test("production recommendation changes after promotion and rollback restores it", async () => {
    const approvedBenefits = approvedAmexPilotBenefits();
    const promoted = promoteAmexPilotFixture();
    const rolledBack = rollbackAmexPilotFixture();
    const promotedBenefits = approvedBenefits.map((benefit) =>
      benefit.id === promoted.promotion.benefit?.id
        ? promoted.promotion.benefit
        : benefit,
    );
    const rolledBackBenefits = promotedBenefits.map((benefit) =>
      benefit.id === rolledBack.rollback.benefit?.id
        ? rolledBack.rollback.benefit
        : benefit,
    );

    mockedGetDb
      .mockResolvedValueOnce(makeDb([amexPilotCardFromBenefits(promotedBenefits)]))
      .mockResolvedValueOnce(makeDb([amexPilotCardFromBenefits(rolledBackBenefits)]));

    const afterPromotion = await recommendBestCards({
      merchant: "lululemon",
      amount: 80,
      allowedCardSlugs: ["amex-platinum"],
      scoringMode: "strict_production",
      purchaseChannel: "online",
      enrolledBenefitIds: [LULULEMON_BENEFIT_ID, CANONICALIZED_LULULEMON_BENEFIT_ID],
      walletBenefitStates: [
        canonicalizeWalletBenefitState({
          userId: "u1",
          cardSlug: "amex-platinum",
          benefitId: CANONICALIZED_LULULEMON_BENEFIT_ID,
          enrollmentStatus: "enrolled",
          activationStatus: "not_required",
          remainingValue: 100,
          cycleValueLimit: 100,
          cycleFrequency: "quarterly",
          confidenceSource: "user_verified",
        }),
      ],
    });
    const afterRollback = await recommendBestCards({
      merchant: "lululemon",
      amount: 80,
      allowedCardSlugs: ["amex-platinum"],
      scoringMode: "strict_production",
      purchaseChannel: "online",
      enrolledBenefitIds: [LULULEMON_BENEFIT_ID, CANONICALIZED_LULULEMON_BENEFIT_ID],
      walletBenefitStates: [
        canonicalizeWalletBenefitState({
          userId: "u1",
          cardSlug: "amex-platinum",
          benefitId: CANONICALIZED_LULULEMON_BENEFIT_ID,
          enrollmentStatus: "enrolled",
          activationStatus: "not_required",
          remainingValue: 75,
          cycleValueLimit: 75,
          cycleFrequency: "quarterly",
          confidenceSource: "user_verified",
        }),
      ],
    });

    expect(afterPromotion.recommendations[0]).toEqual(
      expect.objectContaining({
        estValueUSD: 100,
        matchedBenefit: "$100 statement credit at lululemon each quarter",
      }),
    );
    expect(afterRollback.recommendations[0]).toEqual(
      expect.objectContaining({
        estValueUSD: 75,
        matchedBenefit: "$75 statement credit at lululemon each quarter",
      }),
    );
  });
});
