import {
  canonicalizeCardBenefits,
  scoreBenefitFreshness,
} from "../src/services/benefitIntelligenceService";

describe("benefitIntelligenceService", () => {
  test("canonicalizes card-shaped benefit data into structured records", () => {
    const records = canonicalizeCardBenefits({
      slug: "amex-platinum",
      name: "The Platinum Card",
      issuer: "American Express",
      benefitsDetail: {
        confidence: 0.91,
        lastScraped: "2026-07-01T00:00:00.000Z",
        lastVerified: "2026-07-02T00:00:00.000Z",
        productionEligible: true,
        sourceUrl: "https://issuer.example/card",
        rewardsByCategory: [
          {
            keys: ["travel"],
            rate: "5x",
            unit: "points",
            confidence: 0.9,
          },
        ],
        merchantCredits: [
          {
            id: "lululemon-credit",
            label: "$75 statement credit at lululemon",
            amountUSD: 75,
            period: "quarter",
            capPerPeriodUSD: 75,
            eligibleWhen: { merchantPatterns: ["lululemon"] },
            requiresEnrollment: true,
            confidence: 0.86,
          },
        ],
        insurances: [{ id: "purchase-protection", label: "Purchase Protection" }],
      },
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardSlug: "amex-platinum",
          cardIssuer: "American Express",
          benefitType: "reward_multiplier",
          merchantCategory: "travel",
          multiplier: 5,
          verificationStatus: "verified",
        }),
        expect.objectContaining({
          benefitType: "statement_credit",
          specificMerchant: "lululemon",
          annualCredits: 300,
          redemptionLimitations: ["Enrollment required"],
          confidenceScore: 0.86,
        }),
        expect.objectContaining({
          benefitType: "insurance",
          label: "Purchase Protection",
        }),
      ]),
    );
  });

  test("lastScraped is observed metadata and does not populate lastVerified", () => {
    const records = canonicalizeCardBenefits({
      slug: "observed-card",
      name: "Observed Card",
      issuer: "Issuer",
      benefitsDetail: {
        lastScraped: "2026-07-01T00:00:00.000Z",
        sourceUrl: "https://issuer.example/card",
        rewardsByCategory: [{ keys: ["dining"], rate: "3x", unit: "points" }],
      },
    });

    expect(records[0]).toEqual(
      expect.objectContaining({
        lastObservedAt: "2026-07-01T00:00:00.000Z",
        lastVerified: null,
        verificationStatus: "needs_review",
      }),
    );
  });

  test("scores benefit freshness from verification age", () => {
    const now = new Date("2026-07-22T00:00:00.000Z");

    expect(scoreBenefitFreshness("2026-07-01T00:00:00.000Z", now)).toBe(1);
    expect(scoreBenefitFreshness("2025-10-01T00:00:00.000Z", now)).toBe(0.78);
    expect(scoreBenefitFreshness("2024-01-01T00:00:00.000Z", now)).toBe(0.52);
    expect(scoreBenefitFreshness(null, now)).toBe(0.45);
  });
});
