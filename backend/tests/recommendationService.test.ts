import {
  recommendAllBenefits as recommendAllBenefitsRaw,
  recommendBestCards as recommendBestCardsRaw,
} from "../src/services/recommendationService";

// --- Correct mocks for your current structure ---
jest.mock("../src/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("../src/utils/category", () => ({
  inferCategories: jest.fn(),
}));

jest.mock("../src/utils/valuation", () => ({
  toCashEquivalent: jest.fn(
    (unit: "cash" | "points" | "miles", rate: number, issuer: string) => {
      if (unit === "cash") return rate / 100; // e.g., 2 -> 0.02
      const big = /chase|american express|amex|citi/i.test(issuer)
        ? 0.015
        : 0.01; // 1.5cpp vs 1cpp
      return rate * big; // e.g., 3x -> 0.045
    },
  ),
}));

import { getDb } from "../src/db";
import { canonicalizeWalletBenefitState } from "../src/services/walletIntelligenceService";
import { inferCategories } from "../src/utils/category";

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockedInferCategories = inferCategories as jest.MockedFunction<
  typeof inferCategories
>;

type Card = any;
const recommendAllBenefits = (opts: any) =>
  recommendAllBenefitsRaw({
    ...opts,
    scoringMode: opts.scoringMode || "compatibility",
  });
const recommendBestCards = (opts: any) =>
  recommendBestCardsRaw({
    ...opts,
    scoringMode: opts.scoringMode || "compatibility",
  });

function makeDb(cards: Card[]) {
  return {
    collection: () => ({
      find: () => ({ toArray: async () => cards }),
    }),
  } as any;
}

describe("recommendationService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-15T00:00:00Z"));
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  test("filters nav/CTA and cleans perks while keeping strong signals", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "card-a",
          name: "Card A",
          issuer: "Chase",
          annualFee: 0,
          rewardsFlat: [{ rate: 1, unit: "cash" }],
          perks: [
            "Learn more about this card",
            "5% on dining at restaurants",
            "Purchase protection and extended warranty",
            "Open in the same window",
            "Global Entry credit",
          ],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendAllBenefits({
      merchant: "Test Restaurant",
      amount: 100,
      includeRotating: true,
    });

    expect(out.offers).toHaveLength(1);
    const perks = out.offers[0].perks;
    expect(perks.some((p: string) => /5% on dining/i.test(p))).toBe(true);
    expect(perks.some((p: string) => /purchase protection/i.test(p))).toBe(
      true,
    );
    expect(perks.some((p: string) => /learn more/i.test(p))).toBe(false);
    expect(perks.some((p: string) => /open in the same window/i.test(p))).toBe(
      false,
    );
  });

  test("chooses category match over baseline and computes estValueUSD", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "card-a",
          name: "Card A",
          issuer: "Other",
          annualFee: 0,
          rewardsFlat: [{ rate: 1, unit: "cash" }],
          rewardsByCategory: { restaurants: "3%", other: "1%" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendAllBenefits({
      merchant: "Food Place",
      amount: 200,
      includeRotating: true,
    });
    const offer = out.offers[0];
    expect(offer.effectiveRate).toBeCloseTo(0.03, 5);
    expect(offer.estValueUSD).toBeCloseTo(6.0, 2);
    expect(offer.reason).toMatch(/category:restaurants/i);
  });

  test("supports array-based category entries and matches synonyms", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "card-b",
          name: "Card B",
          issuer: "Citi",
          annualFee: 95,
          rewardsByCategory: [
            { keys: ["restaurants"], rate: "4x", unit: "points" },
          ],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendAllBenefits({ merchant: "Cafe", amount: 50 });
    const offer = out.offers[0];
    expect(offer.effectiveRate).toBeCloseTo(0.06, 5); // 4x * 1.5cpp
    expect(offer.reason).toMatch(/4x on restaurants/i);
  });

  test("applies rotating categories only when active and adjusts confidence", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "card-c",
          name: "Card C",
          issuer: "Discover",
          annualFee: 0,
          sourceUrl: "https://issuer.example/card-c",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
          rewardsRotating: [
            {
              start: "2025-01-01",
              end: "2025-03-31",
              activationRequired: true,
              categories: [{ keys: ["groceries"], rate: "5%", unit: "cash" }],
            },
            {
              categories: [{ keys: ["gas"], rate: "5%", unit: "cash" }], // no window -> uncertain
            },
          ],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["groceries"]);

    const out = await recommendAllBenefits({
      merchant: "Supermarket",
      amount: 100,
      scoringMode: "strict_production",
      activatedBenefitIds: ["card-c:rotating:groceries:5"],
      knownActivationBenefitIds: ["card-c:rotating:groceries:5"],
      walletBenefitStates: [
        canonicalizeWalletBenefitState({
          userId: "u1",
          cardSlug: "card-c",
          benefitId: "card-c:rotating:groceries:5",
          enrollmentStatus: "not_required",
          activationStatus: "activated",
          remainingSpendCap: 1500,
          cycleSpendLimit: 1500,
          cycleFrequency: "quarterly",
          confidenceSource: "user_verified",
        }),
      ],
    });
    const offer = out.offers[0];
    expect(offer.effectiveRate).toBeCloseTo(0.05, 5);
    expect(offer.reason).toMatch(/rotating/i);
    expect(offer.confidence).toBeGreaterThan(0.6);
  });

  test("filters out zero-rate cards unless they include perks or signup offer", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "zero-a",
          name: "Zero A",
          issuer: "Other",
          rewardsFlat: [{ rate: 0, unit: "cash" }],
          perks: [],
        },
        {
          slug: "zero-b",
          name: "Zero B",
          issuer: "Other",
          rewardsFlat: [{ rate: 0, unit: "cash" }],
          perks: ["No foreign transaction fee"],
        },
        {
          slug: "zero-c",
          name: "Zero C",
          issuer: "Other",
          rewardsFlat: [{ rate: 0, unit: "cash" }],
          signupOffer: "Earn 50,000 points after you spend $3,000",
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["other"]);

    const out = await recommendAllBenefits({ merchant: "Misc", amount: 10 });
    expect(out.offers.map((o: any) => o.slug).sort()).toEqual([
      "zero-b",
      "zero-c",
    ]);
  });

  test("recommendBestCards returns sorted projected recommendations", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "a",
          name: "A",
          issuer: "Other",
          rewardsFlat: [{ rate: 1, unit: "cash" }],
        }, // 1%
        {
          slug: "b",
          name: "B",
          issuer: "Other",
          rewardsByCategory: { restaurants: "3%" },
        },
        {
          slug: "c",
          name: "C",
          issuer: "Citi",
          rewardsByCategory: { restaurants: "4x" },
          annualFee: 95,
        },
        {
          slug: "d",
          name: "D",
          issuer: "Other",
          rewardsByCategory: { restaurants: "2%" },
        },
        {
          slug: "e",
          name: "E",
          issuer: "Other",
          rewardsByCategory: { restaurants: "1%" },
        },
        {
          slug: "f",
          name: "F",
          issuer: "Other",
          rewardsByCategory: { restaurants: "0.5%" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({ merchant: "Diner", amount: 100 });
    expect(out.recommendations).toHaveLength(6);
    expect(out.recommendations[0].slug).toBe("c"); // 4x points (0.06) beats 3%
    expect(out.recommendations[1].slug).toBe("b");
    const top = out.recommendations[0];
    expect(top).toHaveProperty("effectiveRate");
    expect(top).toHaveProperty("estValueUSD");
    expect(top).toHaveProperty("annualFee");
  });

  test("recommendBestCards includes fallback recommendations after exact merchant matches", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "amex-platinum",
          name: "Amex Platinum",
          issuer: "American Express",
          annualFee: 695,
          sourceUrl: "https://issuer.example/platinum",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
          merchantCredits: [
            {
              id: "lululemon-credit",
              label: "$75 statement credit at lululemon each quarter",
              amountUSD: 75,
              period: "quarter",
              eligibleWhen: { merchantPatterns: ["lululemon"] },
              sourceUrl: "https://issuer.example/platinum/lululemon",
              confidence: 0.95,
            },
          ],
        },
        {
          slug: "flat-2",
          name: "Flat 2",
          issuer: "Other",
          rewardsFlat: [{ rate: 2, unit: "cash" }],
        },
        {
          slug: "flat-15",
          name: "Flat 1.5",
          issuer: "Other",
          rewardsFlat: [{ rate: 1.5, unit: "cash" }],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["apparel"]);

    const out = await recommendBestCards({
      merchant: "lululemon",
      amount: 100,
    });

    expect(out.recommendations.map((r: any) => r.slug)).toEqual([
      "amex-platinum",
      "flat-2",
      "flat-15",
    ]);
    expect(out.recommendations[0].matchTier).toBe("exact_benefit");
    expect(out.recommendations[1].matchTier).toBe("base_rate");
  });

  test("broad category searches do not promote text perks to exact benefit matches", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "dining-card",
          name: "Dining Card",
          issuer: "Other",
          rewardsByCategory: { dining: "3%", other: "1%" },
          perks: ["3% cash back on dining and drugstores"],
        },
        {
          slug: "resy-card",
          name: "Resy Card",
          issuer: "American Express",
          rewardsByCategory: { other: "1%" },
          recurringCredits: [
            {
              label: "$400 Resy dining credit",
              amountUSD: 400,
              period: "year",
              partner: "Resy",
            },
          ],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({ merchant: "dining", amount: 100 });

    expect(out.recommendations[0].slug).toBe("dining-card");
    expect(out.recommendations[0].matchTier).toBe("category_match");
    expect(
      out.recommendations.some((r: any) => r.matchTier === "exact_benefit"),
    ).toBe(false);
  });

  test("allowedCardSlugs filters candidates before scoring when user owns Amex Gold only", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
          rewardsByCategory: { restaurants: "4x", other: "1x" },
        },
        {
          slug: "chase-sapphire-reserve",
          name: "Chase Sapphire Reserve",
          issuer: "Chase",
          rewardsByCategory: { restaurants: "10x", other: "1x" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({
      merchant: "restaurant",
      amount: 100,
      allowedCardSlugs: ["amex-gold"],
    });

    expect(out.recommendations.map((card: any) => card.slug)).toEqual([
      "amex-gold",
    ]);
    expect(
      out.recommendations.some((card: any) => /chase/i.test(card.slug)),
    ).toBe(false);
  });

  test("allowedCardSlugs filters candidates before scoring when user owns Chase only", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "amex-platinum",
          name: "Amex Platinum",
          issuer: "American Express",
          merchantCredits: [
            {
              label: "$75 statement credit at lululemon",
              amountUSD: 75,
              eligibleWhen: { merchantPatterns: ["lululemon"] },
            },
          ],
        },
        {
          slug: "chase-freedom-unlimited",
          name: "Chase Freedom Unlimited",
          issuer: "Chase",
          rewardsFlat: [{ rate: 1.5, unit: "cash" }],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["apparel"]);

    const out = await recommendBestCards({
      merchant: "lululemon",
      amount: 100,
      allowedCardSlugs: ["chase-freedom-unlimited"],
    });

    expect(out.recommendations.map((card: any) => card.slug)).toEqual([
      "chase-freedom-unlimited",
    ]);
    expect(
      out.recommendations.some((card: any) => /amex/i.test(card.slug)),
    ).toBe(false);
  });

  test("empty allowedCardSlugs returns no recommendations instead of scoring full catalog", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "chase-sapphire-reserve",
          name: "Chase Sapphire Reserve",
          issuer: "Chase",
          rewardsByCategory: { restaurants: "10x" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({
      merchant: "restaurant",
      amount: 100,
      allowedCardSlugs: [],
    });

    expect(
      out.recommendations.some(
        (recommendation: any) => recommendation.matchTier === "exact_benefit",
      ),
    ).toBe(false);
  });

  test("omitting allowedCardSlugs still scores the full catalog for demo/search flows", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
          rewardsByCategory: { restaurants: "4x" },
        },
        {
          slug: "chase-sapphire-reserve",
          name: "Chase Sapphire Reserve",
          issuer: "Chase",
          rewardsByCategory: { restaurants: "10x" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({
      merchant: "restaurant",
      amount: 100,
    });

    expect(out.recommendations.map((card: any) => card.slug)).toContain(
      "amex-gold",
    );
    expect(out.recommendations.map((card: any) => card.slug)).toContain(
      "chase-sapphire-reserve",
    );
  });

  test("expired merchant benefit cannot create an exact-benefit recommendation", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "expired-credit-card",
          name: "Expired Credit Card",
          issuer: "Issuer",
          sourceUrl: "https://issuer.example/card",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
          merchantCredits: [
            {
              id: "expired-lululemon",
              label: "$75 statement credit at lululemon",
              amountUSD: 75,
              period: "quarter",
              eligibleWhen: { merchantPatterns: ["lululemon"] },
              expiresAt: "2024-12-31T00:00:00.000Z",
              sourceUrl: "https://issuer.example/card",
              confidence: 0.95,
            },
          ],
        },
        {
          slug: "flat-2",
          name: "Flat 2",
          issuer: "Other",
          rewardsFlat: [{ rate: 2, unit: "cash" }],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["apparel"]);

    const out = await recommendBestCards({
      merchant: "lululemon",
      amount: 100,
      scoringMode: "strict_production",
    });

    expect(out.recommendations).toEqual([]);
    expect(
      out.recommendations.some(
        (recommendation: any) =>
          recommendation.slug === "expired-credit-card" &&
          recommendation.matchTier === "exact_benefit",
      ),
    ).toBe(false);
  });

  test("unapproved merchant benefit cannot create a fabricated special-benefit match", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "review-card",
          name: "Review Card",
          issuer: "Issuer",
          merchantCredits: [
            {
              id: "review-lululemon",
              label: "$75 statement credit at lululemon",
              amountUSD: 75,
              period: "quarter",
              eligibleWhen: { merchantPatterns: ["lululemon"] },
              confidence: 0.95,
            },
          ],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["apparel"]);

    const out = await recommendBestCards({
      merchant: "lululemon",
      amount: 100,
      scoringMode: "strict_production",
    });

    expect(
      out.recommendations.some(
        (recommendation: any) => recommendation.matchTier === "exact_benefit",
      ),
    ).toBe(false);
  });

  test("recommendation explanation references the benefit that won scoring", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "approved-credit-card",
          name: "Approved Credit Card",
          issuer: "Issuer",
          sourceUrl: "https://issuer.example/card",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
          merchantCredits: [
            {
              id: "lululemon-credit",
              label: "$75 statement credit at lululemon",
              amountUSD: 75,
              period: "quarter",
              eligibleWhen: { merchantPatterns: ["lululemon"] },
              sourceUrl: "https://issuer.example/card",
              confidence: 0.95,
            },
          ],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["apparel"]);

    const out = await recommendBestCards({
      merchant: "lululemon",
      amount: 100,
    });

    expect(out.recommendations[0]).toEqual(
      expect.objectContaining({
        matchTier: "exact_benefit",
        matchedBenefit: "$75 statement credit at lululemon",
      }),
    );
    expect(out.recommendations[0].why).toEqual(
      expect.arrayContaining([
        "Benefit: $75 statement credit at lululemon",
      ]),
    );
  });

  test("unverified flat reward cannot win in strict production mode", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "unverified-flat",
          name: "Unverified Flat",
          issuer: "Other",
          rewardsFlat: [{ rate: 10, unit: "cash" }],
          sourceUrl: "https://issuer.example/unverified",
          lastScraped: "2025-01-01T00:00:00.000Z",
        },
        {
          slug: "verified-flat",
          name: "Verified Flat",
          issuer: "Other",
          rewardsFlat: [{ rate: 1, unit: "cash" }],
          sourceUrl: "https://issuer.example/verified",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["other"]);

    const out = await recommendBestCards({
      merchant: "Amazon",
      amount: 100,
      scoringMode: "strict_production",
    });

    expect(out.recommendations.map((card: any) => card.slug)).toEqual([
      "verified-flat",
    ]);
  });

  test("unverified category reward cannot win in strict production mode", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "unverified-category",
          name: "Unverified Category",
          issuer: "Other",
          rewardsByCategory: { restaurants: "10%" },
          sourceUrl: "https://issuer.example/unverified",
          lastScraped: "2025-01-01T00:00:00.000Z",
        },
        {
          slug: "verified-category",
          name: "Verified Category",
          issuer: "Other",
          rewardsByCategory: { restaurants: "3%" },
          sourceUrl: "https://issuer.example/verified",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({
      merchant: "Diner",
      amount: 100,
      scoringMode: "strict_production",
    });

    expect(out.recommendations[0]).toEqual(
      expect.objectContaining({
        slug: "verified-category",
        matchTier: "category_match",
        lastVerified: "2025-01-01T00:00:00.000Z",
        sourceUrl: "https://issuer.example/verified",
      }),
    );
  });

  test("unverified rotating reward cannot win in strict production mode", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "unverified-rotating",
          name: "Unverified Rotating",
          issuer: "Other",
          rewardsRotating: [
            {
              start: "2025-01-01",
              end: "2025-03-31",
              categories: [{ keys: ["groceries"], rate: "10%", unit: "cash" }],
            },
          ],
          sourceUrl: "https://issuer.example/unverified",
          lastScraped: "2025-01-01T00:00:00.000Z",
        },
        {
          slug: "verified-rotating",
          name: "Verified Rotating",
          issuer: "Other",
          rewardsRotating: [
            {
              start: "2025-01-01",
              end: "2025-03-31",
              categories: [{ keys: ["groceries"], rate: "5%", unit: "cash" }],
            },
          ],
          sourceUrl: "https://issuer.example/verified",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["groceries"]);

    const out = await recommendBestCards({
      merchant: "Supermarket",
      amount: 100,
      scoringMode: "strict_production",
    });

    expect(out.recommendations[0].slug).toBe("verified-rotating");
  });

  test("recently observed but unverified benefit remains ineligible in strict production mode", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "observed-card",
          name: "Observed Card",
          issuer: "Other",
          rewardsByCategory: { restaurants: "10%" },
          sourceUrl: "https://issuer.example/observed",
          lastScraped: "2025-01-15T00:00:00.000Z",
          productionEligible: true,
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({
      merchant: "Diner",
      amount: 100,
      scoringMode: "strict_production",
    });

    expect(out.recommendations).toEqual([]);
  });

  test("strict Lululemon exact benefit requires known enrolled state", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "amex-platinum",
          name: "Amex Platinum",
          issuer: "American Express",
          sourceUrl: "https://issuer.example/platinum",
          lastVerified: "2025-01-01T00:00:00.000Z",
          productionEligible: true,
          merchantCredits: [
            {
              id: "lululemon-credit",
              label: "$75 statement credit at lululemon",
              amountUSD: 75,
              period: "quarter",
              eligibleWhen: { merchantPatterns: ["lululemon"] },
              requiresEnrollment: true,
              sourceUrl: "https://issuer.example/platinum/lululemon",
              confidence: 0.95,
            },
          ],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["apparel"]);

    const benefitId = "amex-platinum:merchant-credit:lululemon-credit";
    const out = await recommendBestCards({
      merchant: "lululemon",
      amount: 100,
      scoringMode: "strict_production",
      enrolledBenefitIds: [benefitId],
      knownEnrollmentBenefitIds: [benefitId],
      walletBenefitStates: [
        canonicalizeWalletBenefitState({
          userId: "u1",
          cardSlug: "amex-platinum",
          benefitId,
          enrollmentStatus: "enrolled",
          activationStatus: "not_required",
          remainingValue: 75,
          cycleValueLimit: 75,
          cycleFrequency: "quarterly",
          confidenceSource: "user_verified",
        }),
      ],
    });

    expect(out.recommendations[0]).toEqual(
      expect.objectContaining({
        slug: "amex-platinum",
        matchTier: "exact_benefit",
        matchedBenefitId: benefitId,
        sourceUrl: "https://issuer.example/platinum/lululemon",
        lastVerified: "2025-01-01T00:00:00.000Z",
      }),
    );
  });

  test("high-confidence purchase context can refine recommendation categories", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "flat-card",
          name: "Flat Card",
          issuer: "Other",
          rewardsFlat: [{ rate: 2, unit: "cash" }],
        },
        {
          slug: "grocery-card",
          name: "Grocery Card",
          issuer: "Other",
          rewardsByCategory: { groceries: "5%" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["online_shopping"]);

    const out = await recommendBestCards({
      merchant: "Amazon",
      amount: 100,
      recommendationPurchaseContext: {
        dominantCategory: "groceries",
        categoryDistribution: [
          { normalizedCategory: "groceries", estimatedAmount: 100, share: 1 },
        ],
        exclusions: [],
        confidenceScore: 0.9,
        confidenceLabel: "high",
        hasGiftCard: false,
        hasCashEquivalent: false,
        hasDigitalGoods: false,
        hasSubscription: false,
        total: 100,
        eligibleAmount: 100,
        materiallyMixed: false,
        mixedCartThreshold: 0.2,
        refinement: "purchase_refined",
      },
    });

    expect(out.recommendations[0].slug).toBe("grocery-card");
    expect(out.categoriesUsed).toEqual(expect.arrayContaining(["groceries"]));
    expect(out.recommendations[0].explanationEvidence.scoring).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "purchase_context" }),
      ]),
    );
  });

  test("low-confidence purchase context does not alter merchant-based ranking", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "flat-card",
          name: "Flat Card",
          issuer: "Other",
          rewardsFlat: [{ rate: 2, unit: "cash" }],
        },
        {
          slug: "grocery-card",
          name: "Grocery Card",
          issuer: "Other",
          rewardsByCategory: { groceries: "5%" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["online_shopping"]);

    const out = await recommendBestCards({
      merchant: "Amazon",
      amount: 100,
      recommendationPurchaseContext: {
        dominantCategory: "groceries",
        categoryDistribution: [
          { normalizedCategory: "groceries", estimatedAmount: 100, share: 1 },
        ],
        exclusions: [],
        confidenceScore: 0.35,
        confidenceLabel: "low",
        hasGiftCard: false,
        hasCashEquivalent: false,
        hasDigitalGoods: false,
        hasSubscription: false,
        total: 100,
        eligibleAmount: 100,
        materiallyMixed: false,
        mixedCartThreshold: 0.2,
        refinement: "low_confidence_fallback",
      },
    });

    expect(out.recommendations[0].slug).toBe("flat-card");
    expect(out.categoriesUsed).not.toContain("groceries");
    expect(out.recommendations[0].explanationEvidence.missingInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LOW_PURCHASE_CONFIDENCE" }),
      ]),
    );
  });

  test("mixed carts preserve merchant ranking and surface a warning", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "online-card",
          name: "Online Card",
          issuer: "Other",
          rewardsByCategory: { online_shopping: "4%" },
        },
        {
          slug: "grocery-card",
          name: "Grocery Card",
          issuer: "Other",
          rewardsByCategory: { groceries: "5%" },
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["online_shopping"]);

    const out = await recommendBestCards({
      merchant: "Amazon",
      amount: 100,
      recommendationPurchaseContext: {
        dominantCategory: "groceries",
        categoryDistribution: [
          { normalizedCategory: "groceries", estimatedAmount: 60, share: 0.6 },
          { normalizedCategory: "electronics", estimatedAmount: 40, share: 0.4 },
        ],
        exclusions: [],
        confidenceScore: 0.88,
        confidenceLabel: "high",
        hasGiftCard: false,
        hasCashEquivalent: false,
        hasDigitalGoods: false,
        hasSubscription: false,
        total: 100,
        eligibleAmount: 100,
        materiallyMixed: true,
        mixedCartThreshold: 0.2,
        refinement: "mixed_cart_fallback",
      },
    });

    expect(out.recommendations[0].slug).toBe("online-card");
    expect(out.categoriesUsed).not.toContain("groceries");
    expect(out.recommendations[0].explanationEvidence.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MIXED_CART_LIMITATION" }),
      ]),
    );
  });

  test("excluded gift-card spend cannot create bonus-category value", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "online-card",
          name: "Online Card",
          issuer: "Other",
          rewardsByCategory: { online_shopping: "5%" },
        },
        {
          slug: "flat-card",
          name: "Flat Card",
          issuer: "Other",
          rewardsFlat: [{ rate: 2, unit: "cash" }],
        },
      ] as Card[]),
    );
    mockedInferCategories.mockReturnValue(["online_shopping"]);

    const out = await recommendBestCards({
      merchant: "Amazon",
      amount: 100,
      recommendationPurchaseContext: {
        dominantCategory: "gift_card",
        categoryDistribution: [
          { normalizedCategory: "gift_card", estimatedAmount: 100, share: 1 },
        ],
        exclusions: ["gift_card"],
        confidenceScore: 0.95,
        confidenceLabel: "high",
        hasGiftCard: true,
        hasCashEquivalent: false,
        hasDigitalGoods: false,
        hasSubscription: false,
        total: 100,
        eligibleAmount: 0,
        materiallyMixed: true,
        mixedCartThreshold: 0.2,
        refinement: "mixed_cart_fallback",
      },
    });

    expect(out.recommendations[0].slug).toBe("flat-card");
    expect(out.recommendations[0].estValueUSD).toBe(0);
    expect(out.recommendations[0].explanationEvidence.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PURCHASE_EXCLUSIONS_APPLIED" }),
      ]),
    );
  });
});
