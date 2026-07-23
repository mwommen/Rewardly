import type { CanonicalBenefitRecord } from "../src/services/benefitIntelligenceService";
import {
  createBenefitVersionChange,
  diffBenefitRecord,
} from "../src/services/benefitVersioningService";

const benefit: CanonicalBenefitRecord = {
  id: "card:credit",
  cardId: "card",
  cardSlug: "card",
  cardIssuer: "Issuer",
  cardName: "Card",
  benefitName: "$50 merchant credit",
  benefitDescription: "$50 merchant credit",
  benefitType: "statement_credit",
  rewardMechanism: "statement_credit",
  label: "$50 merchant credit",
  merchantCategory: null,
  specificMerchantIds: ["merchant"],
  specificMerchant: "merchant",
  eligiblePurchaseChannels: ["online"],
  multiplier: null,
  statementCredit: { amountUSD: 50, period: "year", capPerPeriodUSD: 50 },
  annualCredits: 50,
  spendingCap: { amountUSD: 50, period: "year" },
  minimumSpend: null,
  enrollmentRequired: false,
  activationRequired: false,
  travelBenefits: [],
  diningBenefits: [],
  shoppingBenefits: [],
  redemptionLimitations: [],
  exclusions: [],
  geographicRestrictions: [],
  effectiveDate: "2026-01-01T00:00:00.000Z",
  expirationDate: null,
  sourceUrl: "https://issuer.example/benefit",
  sourceType: "issuer_official",
  sourceTitle: "Issuer benefit",
  lastObservedAt: "2026-07-01T00:00:00.000Z",
  lastVerified: "2026-07-01T00:00:00.000Z",
  verificationSource: "https://issuer.example/benefit",
  confidenceScore: 0.9,
  verificationStatus: "verified",
  productionEligible: true,
  version: 1,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  sourceKind: "merchant_credit",
};

describe("benefitVersioningService", () => {
  test("benefit version changes preserve previous records", () => {
    const updated = {
      ...benefit,
      statementCredit: { amountUSD: 75, period: "year", capPerPeriodUSD: 75 },
      annualCredits: 75,
    };

    const change = createBenefitVersionChange({
      previousValue: benefit,
      newValue: updated,
      changeSource: "test",
      changedAt: "2026-07-22T00:00:00.000Z",
    });

    expect(change.previousValue?.statementCredit?.amountUSD).toBe(50);
    expect(change.newValue.statementCredit?.amountUSD).toBe(75);
    expect(change.newValue.version).toBe(2);
    expect(change.changeType).toBe("updated");
  });

  test("diffBenefitRecord reports changed fields", () => {
    expect(
      diffBenefitRecord(benefit, {
        ...benefit,
        productionEligible: false,
        verificationStatus: "needs_review",
      }),
    ).toEqual(expect.arrayContaining(["productionEligible", "verificationStatus"]));
  });
});
