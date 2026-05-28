import { recommendAllBenefits, recommendBestCards } from "../src/services/recommendationService";

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
      const big = /chase|american express|amex|citi/i.test(issuer) ? 0.015 : 0.01; // 1.5cpp vs 1cpp
      return rate * big; // e.g., 3x -> 0.045
    }
  ),
}));

import { getDb } from "../src/db";
import { inferCategories } from "../src/utils/category";

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockedInferCategories = inferCategories as jest.MockedFunction<typeof inferCategories>;

type Card = any;
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
      ] as Card[])
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
    expect(perks.some((p: string) => /purchase protection/i.test(p))).toBe(true);
    expect(perks.some((p: string) => /learn more/i.test(p))).toBe(false);
    expect(perks.some((p: string) => /open in the same window/i.test(p))).toBe(false);
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
      ] as Card[])
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendAllBenefits({ merchant: "Food Place", amount: 200, includeRotating: true });
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
          rewardsByCategory: [{ keys: ["restaurants"], rate: "4x", unit: "points" }],
        },
      ] as Card[])
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendAllBenefits({ merchant: "Cafe", amount: 50 });
    const offer = out.offers[0];
    expect(offer.effectiveRate).toBeCloseTo(0.06, 5); // 4x * 1.5cpp
    expect(offer.reason).toMatch(/array match/i);
  });

  test("applies rotating categories only when active and adjusts confidence", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        {
          slug: "card-c",
          name: "Card C",
          issuer: "Discover",
          annualFee: 0,
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
      ] as Card[])
    );
    mockedInferCategories.mockReturnValue(["groceries"]);

    const out = await recommendAllBenefits({ merchant: "Supermarket", amount: 100 });
    const offer = out.offers[0];
    expect(offer.effectiveRate).toBeCloseTo(0.05, 5);
    expect(offer.reason).toMatch(/rotating/i);
    expect(offer.confidence).toBeLessThan(0.6);
  });

  test("filters out zero-rate cards unless they include perks or signup offer", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        { slug: "zero-a", name: "Zero A", issuer: "Other", rewardsFlat: [{ rate: 0, unit: "cash" }], perks: [] },
        { slug: "zero-b", name: "Zero B", issuer: "Other", rewardsFlat: [{ rate: 0, unit: "cash" }], perks: ["No foreign transaction fee"] },
        { slug: "zero-c", name: "Zero C", issuer: "Other", rewardsFlat: [{ rate: 0, unit: "cash" }], signupOffer: "Earn 50,000 points after you spend $3,000" },
      ] as Card[])
    );
    mockedInferCategories.mockReturnValue(["other"]);

    const out = await recommendAllBenefits({ merchant: "Misc", amount: 10 });
    expect(out.offers.map((o: any) => o.slug).sort()).toEqual(["zero-b", "zero-c"]);
  });

  test("recommendBestCards returns sorted projected recommendations", async () => {
    mockedGetDb.mockResolvedValueOnce(
      makeDb([
        { slug: "a", name: "A", issuer: "Other", rewardsFlat: [{ rate: 1, unit: "cash" }] }, // 1%
        { slug: "b", name: "B", issuer: "Other", rewardsByCategory: { restaurants: "3%" } },
        { slug: "c", name: "C", issuer: "Citi", rewardsByCategory: { restaurants: "4x" }, annualFee: 95 },
        { slug: "d", name: "D", issuer: "Other", rewardsByCategory: { restaurants: "2%" } },
        { slug: "e", name: "E", issuer: "Other", rewardsByCategory: { restaurants: "1%" } },
        { slug: "f", name: "F", issuer: "Other", rewardsByCategory: { restaurants: "0.5%" } }
      ] as Card[])
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
          merchantCredits: [
            {
              label: "$75 statement credit at lululemon each quarter",
              amountUSD: 75,
              period: "quarter",
              eligibleWhen: { merchantPatterns: ["lululemon"] },
            },
          ],
        },
        { slug: "flat-2", name: "Flat 2", issuer: "Other", rewardsFlat: [{ rate: 2, unit: "cash" }] },
        { slug: "flat-15", name: "Flat 1.5", issuer: "Other", rewardsFlat: [{ rate: 1.5, unit: "cash" }] },
      ] as Card[])
    );
    mockedInferCategories.mockReturnValue(["apparel"]);

    const out = await recommendBestCards({ merchant: "lululemon", amount: 100 });

    expect(out.recommendations.map((r: any) => r.slug)).toEqual(["amex-platinum", "flat-2", "flat-15"]);
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
      ] as Card[])
    );
    mockedInferCategories.mockReturnValue(["restaurants"]);

    const out = await recommendBestCards({ merchant: "dining", amount: 100 });

    expect(out.recommendations[0].slug).toBe("dining-card");
    expect(out.recommendations[0].matchTier).toBe("category_match");
    expect(out.recommendations.some((r: any) => r.matchTier === "exact_benefit")).toBe(false);
  });
});
