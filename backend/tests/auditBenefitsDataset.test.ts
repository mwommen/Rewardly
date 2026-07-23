import { auditBenefits } from "../src/auditBenefitsDataset";
import type { CanonicalBenefitRecord } from "../src/services/benefitIntelligenceService";

const benefit: CanonicalBenefitRecord = {
  id: "card:reward",
  cardId: "card",
  cardSlug: "card",
  cardIssuer: "Issuer",
  cardName: "Card",
  benefitName: "3x dining",
  benefitDescription: "3x dining",
  benefitType: "reward_multiplier",
  rewardMechanism: "points",
  label: "3x dining",
  merchantCategory: "dining",
  specificMerchantIds: [],
  specificMerchant: null,
  eligiblePurchaseChannels: ["any"],
  multiplier: 3,
  statementCredit: null,
  annualCredits: null,
  spendingCap: null,
  minimumSpend: null,
  enrollmentRequired: false,
  activationRequired: false,
  travelBenefits: [],
  diningBenefits: ["3x dining"],
  shoppingBenefits: [],
  redemptionLimitations: [],
  exclusions: [],
  geographicRestrictions: [],
  effectiveDate: "2026-01-01T00:00:00.000Z",
  expirationDate: null,
  sourceUrl: "https://issuer.example",
  sourceType: "issuer_official",
  sourceTitle: "Issuer",
  lastObservedAt: "2026-07-01T00:00:00.000Z",
  lastVerified: "2026-07-01T00:00:00.000Z",
  verificationSource: "https://issuer.example",
  confidenceScore: 0.92,
  verificationStatus: "verified",
  productionEligible: true,
  version: 1,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  sourceKind: "reward_category",
};

describe("auditBenefitsDataset", () => {
  test("summarizes missing metadata and structural errors", () => {
    const summary = auditBenefits(
      [
        benefit,
        {
          ...benefit,
          id: "card:broken",
          sourceUrl: null,
          lastVerified: null,
          verificationStatus: "needs_review",
          productionEligible: false,
          effectiveDate: "2026-12-31T00:00:00.000Z",
          expirationDate: "2026-01-01T00:00:00.000Z",
        },
        { ...benefit },
      ],
      new Date("2026-07-22T00:00:00.000Z"),
    );

    expect(summary.totalBenefits).toBe(3);
    expect(summary.verifiedBenefits).toBe(2);
    expect(summary.benefitsMissingSources).toBe(1);
    expect(summary.benefitsMissingVerificationDates).toBe(1);
    expect(summary.duplicateBenefitIds).toEqual(["card:reward"]);
    expect(summary.invalidDateRanges).toEqual(["card:broken"]);
    expect(summary.criticalErrors).toEqual(
      expect.arrayContaining([
        "Duplicate benefit id: card:reward",
        "Invalid date range: card:broken",
      ]),
    );
  });
});
