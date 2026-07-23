jest.mock("../src/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("../src/utils/category", () => ({
  inferCategories: jest.fn(),
}));

jest.mock("../src/utils/valuation", () => ({
  toCashEquivalent: jest.fn((unit: string, rate: number) => {
    if (unit === "cash") return rate / 100;
    return rate * 0.01;
  }),
}));

import { getDb } from "../src/db";
import {
  buildMerchantCoverageMatrix,
  getMerchantHierarchy,
  inheritedCategoryTokens,
  inheritedMerchantTokens,
  resolveMerchant,
} from "../src/services/merchantIntelligenceService";
import { recommendBestCards } from "../src/services/recommendationService";
import { canonicalizeWalletBenefitState } from "../src/services/walletIntelligenceService";
import { inferCategories } from "../src/utils/category";

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockedInferCategories = inferCategories as jest.MockedFunction<typeof inferCategories>;

function makeDb(cards: any[]) {
  return {
    collection: () => ({
      find: () => ({ toArray: async () => cards }),
    }),
  } as any;
}

describe("merchantIntelligenceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInferCategories.mockReturnValue(["other"]);
  });

  test("resolves aliases and parent companies", () => {
    const amazon = resolveMerchant({ merchant: "AMZN Mktp" });
    expect(amazon).toEqual(
      expect.objectContaining({
        confidence: 0.95,
        matchingStrategy: "billing_descriptor",
        merchant: expect.objectContaining({
          merchantId: "amazon",
          parentCompany: "Amazon",
        }),
      }),
    );

    const wholeFoods = resolveMerchant({ merchant: "WHOLEFDS" });
    expect(wholeFoods.merchant).toEqual(
      expect.objectContaining({
        merchantId: "whole-foods",
        merchantGroup: "amazon",
        parentCompany: "Amazon",
      }),
    );
    expect(wholeFoods.inheritedMerchantIds).toEqual(expect.arrayContaining(["amazon"]));
  });

  test("resolves billing descriptors, domains, and checkout domains", () => {
    expect(resolveMerchant({ billingDescriptor: "APPLE.COM/BILL" })).toEqual(
      expect.objectContaining({
        matchingStrategy: "billing_descriptor",
        merchant: expect.objectContaining({ merchantId: "apple" }),
      }),
    );
    expect(resolveMerchant({ hostname: "secure.store.apple.com" })).toEqual(
      expect.objectContaining({
        matchingStrategy: "checkout_domain",
        merchant: expect.objectContaining({ merchantId: "apple" }),
      }),
    );
    expect(resolveMerchant({ hostname: "www.amazon.com" })).toEqual(
      expect.objectContaining({
        matchingStrategy: "checkout_domain",
        confidence: 0.9,
        merchant: expect.objectContaining({ merchantId: "amazon" }),
      }),
    );
  });

  test("supports MCC matching and category inheritance", () => {
    const starbucks = resolveMerchant({ merchant: "STARBUCKS APP", mcc: "5814" });
    expect(starbucks.merchant).toEqual(
      expect.objectContaining({
        merchantId: "starbucks",
        knownMccs: expect.arrayContaining(["5814"]),
      }),
    );
    expect(starbucks.inheritedCategoryIds).toEqual(
      expect.arrayContaining(["restaurant", "coffee", "specialty coffee"]),
    );

    const categoryTokens = inheritedCategoryTokens(starbucks.merchant);
    expect(categoryTokens).toEqual(expect.arrayContaining(["restaurant", "dining", "coffee"]));
  });

  test("captures purchase context for marketplace, subscription, international, airport, and gift card cases", () => {
    expect(resolveMerchant({ merchant: "AMZN Mktp" }).purchaseContext.marketplace).toBe(true);
    expect(resolveMerchant({ merchant: "APPLE.COM/BILL" }).purchaseContext.subscription).toBe(true);
    expect(resolveMerchant({ merchant: "Delta Sky Club", purchaseChannel: "airport_location" }).purchaseContext.airportLocation).toBe(true);
    expect(resolveMerchant({ merchant: "Target gift card" }).purchaseContext.giftCard).toBe(true);
    expect(resolveMerchant({ merchant: "Starbucks", country: "CA" }).purchaseContext.international).toBe(true);
  });

  test("handles multiple similar merchants without collapsing brand context", () => {
    expect(resolveMerchant({ merchant: "UBER EATS" }).merchant).toEqual(
      expect.objectContaining({ merchantId: "uber-eats", category: "dining" }),
    );
    expect(resolveMerchant({ merchant: "UBER *TRIP" }).merchant).toEqual(
      expect.objectContaining({ merchantId: "uber", category: "rideshare" }),
    );
    expect(resolveMerchant({ merchant: "Marriott Restaurant" }).merchant).toEqual(
      expect.objectContaining({ merchantId: "marriott", subcategory: "hotel" }),
    );
    expect(resolveMerchant({ merchant: "Target Optical" }).merchant).toEqual(
      expect.objectContaining({ merchantId: "target" }),
    );
  });

  test("unknown merchants return an explicit unknown resolution", () => {
    expect(resolveMerchant({ merchant: "Definitely Not A Known Merchant" })).toEqual(
      expect.objectContaining({
        merchant: null,
        confidence: 0,
        matchingStrategy: "unknown",
      }),
    );
  });

  test("hierarchy and coverage matrix expose regression merchants", () => {
    const hierarchy = getMerchantHierarchy("amazon");
    expect(hierarchy?.children.map((merchant) => merchant.merchantId)).toEqual(
      expect.arrayContaining(["whole-foods", "amazon-fresh", "prime-video", "audible"]),
    );

    const merchants = new Set(buildMerchantCoverageMatrix().map((entry) => entry.merchant));
    [
      "Amazon",
      "Uber",
      "Uber Eats",
      "Starbucks",
      "Marriott",
      "Hilton",
      "Apple",
      "Walmart",
      "Target",
    ].forEach((merchant) => expect(merchants.has(merchant)).toBe(true));
  });

  test("recommendation engine matches benefits through merchant intelligence relationships", async () => {
    mockedInferCategories.mockReturnValue(["groceries"]);
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "amazon-card",
          name: "Amazon Card",
          issuer: "Test",
          annualFee: 0,
          productionEligible: true,
          benefitsDetail: {
            productionEligible: true,
            confidence: 0.95,
            lastVerified: "2026-07-01T00:00:00.000Z",
            merchantCredits: [
              {
                id: "amazon-group-credit",
                label: "$20 Amazon family credit",
                amountUSD: 20,
                period: "month",
                requiresEnrollment: false,
                eligibleWhen: {
                  merchantPatterns: ["amazon group"],
                  channels: ["online"],
                },
              },
            ],
          },
        },
      ]),
    );

    const out = await recommendBestCards({
      merchant: "Whole Foods Market",
      amount: 50,
      scoringMode: "strict_production",
      purchaseChannel: "online",
      walletBenefitStates: [
        canonicalizeWalletBenefitState({
          userId: "u1",
          cardSlug: "amazon-card",
          benefitId: "amazon-card:merchant-credit:amazon-group-credit",
          enrollmentStatus: "not_required",
          activationStatus: "not_required",
          remainingValue: 20,
          cycleValueLimit: 20,
          cycleFrequency: "monthly",
          confidenceSource: "user_verified",
        }),
      ],
    });

    expect(inheritedMerchantTokens(resolveMerchant({ merchant: "Whole Foods Market" }).merchant)).toEqual(
      expect.arrayContaining(["amazon"]),
    );
    expect(out.recommendations[0]).toEqual(
      expect.objectContaining({
        slug: "amazon-card",
        matchedBenefit: "$20 Amazon family credit",
        matchTier: "exact_benefit",
      }),
    );
  });
});
