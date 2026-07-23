import type { CanonicalBenefitRecord } from "../src/services/benefitIntelligenceService";
import { isBenefitEligibleForRecommendation } from "../src/services/benefitEligibilityService";

const baseBenefit: CanonicalBenefitRecord = {
  id: "card:benefit",
  cardId: "card",
  cardSlug: "card",
  cardIssuer: "Issuer",
  cardName: "Card",
  benefitName: "Purchase Protection",
  benefitDescription: "Purchase Protection",
  benefitType: "protection",
  rewardMechanism: "protection",
  label: "Purchase Protection",
  merchantCategory: "electronics",
  specificMerchantIds: [],
  specificMerchant: null,
  eligiblePurchaseChannels: ["online"],
  multiplier: null,
  statementCredit: null,
  annualCredits: null,
  spendingCap: { amountUSD: 500, period: "purchase" },
  minimumSpend: null,
  enrollmentRequired: false,
  activationRequired: false,
  travelBenefits: [],
  diningBenefits: [],
  shoppingBenefits: ["Purchase Protection"],
  redemptionLimitations: [],
  exclusions: [],
  geographicRestrictions: [],
  effectiveDate: "2025-01-01T00:00:00.000Z",
  expirationDate: null,
  sourceUrl: "https://issuer.example/terms",
  sourceType: "issuer_terms",
  sourceTitle: "Issuer terms",
  lastObservedAt: "2026-01-01T00:00:00.000Z",
  lastVerified: "2026-01-01T00:00:00.000Z",
  verificationSource: "https://issuer.example/terms",
  confidenceScore: 0.92,
  verificationStatus: "verified",
  productionEligible: true,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sourceKind: "perk",
};

describe("benefitEligibilityService", () => {
  const now = new Date("2026-07-22T00:00:00.000Z");

  test("verified active benefit is eligible and preserves cap metadata", () => {
    const result = isBenefitEligibleForRecommendation(baseBenefit, {
      now,
      merchantCategory: "electronics",
      purchaseChannel: "online",
    });

    expect(result.eligible).toBe(true);
    expect(baseBenefit.spendingCap?.amountUSD).toBe(500);
  });

  test("expired benefit is rejected", () => {
    const result = isBenefitEligibleForRecommendation(
      { ...baseBenefit, expirationDate: "2026-06-30T00:00:00.000Z" },
      { now, merchantCategory: "electronics", purchaseChannel: "online" },
    );

    expect(result).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_EXPIRED",
      }),
    );
  });

  test("future benefit is rejected before effective date", () => {
    const result = isBenefitEligibleForRecommendation(
      { ...baseBenefit, effectiveDate: "2026-08-01T00:00:00.000Z" },
      { now, merchantCategory: "electronics", purchaseChannel: "online" },
    );

    expect(result).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_NOT_EFFECTIVE",
      }),
    );
  });

  test("unverified and rejected benefits are not production eligible", () => {
    expect(
      isBenefitEligibleForRecommendation(
        { ...baseBenefit, verificationStatus: "needs_review" },
        { now, merchantCategory: "electronics", purchaseChannel: "online" },
      ),
    ).toEqual(expect.objectContaining({ reasonCode: "BENEFIT_UNVERIFIED" }));

    expect(
      isBenefitEligibleForRecommendation(
        { ...baseBenefit, verificationStatus: "rejected" },
        { now, merchantCategory: "electronics", purchaseChannel: "online" },
      ),
    ).toEqual(expect.objectContaining({ reasonCode: "BENEFIT_REJECTED" }));
  });

  test("benefit below confidence threshold is rejected", () => {
    const result = isBenefitEligibleForRecommendation(
      { ...baseBenefit, confidenceScore: 0.45 },
      { now, merchantCategory: "electronics", purchaseChannel: "online" },
    );

    expect(result).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_CONFIDENCE_TOO_LOW",
      }),
    );
  });

  test("merchant-specific benefit only applies to the correct merchant", () => {
    const benefit = {
      ...baseBenefit,
      merchantCategory: null,
      specificMerchant: "lululemon",
      specificMerchantIds: ["lululemon.com"],
    };

    expect(
      isBenefitEligibleForRecommendation(benefit, {
        now,
        merchant: "lululemon",
        purchaseChannel: "online",
      }).eligible,
    ).toBe(true);

    expect(
      isBenefitEligibleForRecommendation(benefit, {
        now,
        merchant: "amazon",
        purchaseChannel: "online",
      }),
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_RESTRICTION_INCOMPATIBLE",
      }),
    );
  });

  test("category benefit applies only to qualifying merchant category", () => {
    expect(
      isBenefitEligibleForRecommendation(baseBenefit, {
        now,
        merchantCategory: "electronics",
        purchaseChannel: "online",
      }).eligible,
    ).toBe(true);

    expect(
      isBenefitEligibleForRecommendation(baseBenefit, {
        now,
        merchantCategory: "dining",
        purchaseChannel: "online",
      }),
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_RESTRICTION_INCOMPATIBLE",
      }),
    );
  });

  test("purchase-channel restrictions are respected", () => {
    const result = isBenefitEligibleForRecommendation(baseBenefit, {
      now,
      merchantCategory: "electronics",
      purchaseChannel: "in_store",
    });

    expect(result).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_PURCHASE_CHANNEL_INCOMPATIBLE",
      }),
    );
  });

  test("enrollment-required benefit is eligible only when enrolled", () => {
    const enrollmentBenefit = { ...baseBenefit, enrollmentRequired: true };
    const result = isBenefitEligibleForRecommendation(
      enrollmentBenefit,
      {
        now,
        merchantCategory: "electronics",
        purchaseChannel: "online",
        enrolledBenefitIds: [enrollmentBenefit.id],
        knownEnrollmentBenefitIds: [enrollmentBenefit.id],
      },
    );

    expect(result.eligible).toBe(true);
  });

  test("enrollment-required benefit is rejected when not enrolled or unknown", () => {
    const enrollmentBenefit = { ...baseBenefit, enrollmentRequired: true };

    expect(
      isBenefitEligibleForRecommendation(enrollmentBenefit, {
        now,
        merchantCategory: "electronics",
        purchaseChannel: "online",
        knownEnrollmentBenefitIds: [enrollmentBenefit.id],
      }),
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_ENROLLMENT_REQUIRED",
      }),
    );

    expect(
      isBenefitEligibleForRecommendation(enrollmentBenefit, {
        now,
        merchantCategory: "electronics",
        purchaseChannel: "online",
      }),
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_USER_STATUS_UNKNOWN",
      }),
    );
  });

  test("activation-required benefit is rejected when not activated or unknown", () => {
    const activationBenefit = { ...baseBenefit, activationRequired: true };

    expect(
      isBenefitEligibleForRecommendation(activationBenefit, {
        now,
        merchantCategory: "electronics",
        purchaseChannel: "online",
        knownActivationBenefitIds: [activationBenefit.id],
      }),
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_ACTIVATION_REQUIRED",
      }),
    );

    expect(
      isBenefitEligibleForRecommendation(activationBenefit, {
        now,
        merchantCategory: "electronics",
        purchaseChannel: "online",
      }),
    ).toEqual(
      expect.objectContaining({
        eligible: false,
        reasonCode: "BENEFIT_USER_STATUS_UNKNOWN",
      }),
    );
  });
});
