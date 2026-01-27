import { findMerchantBenefitsInCards } from "../src/services/benefitsQaService";

describe("benefitsQaService", () => {
  test("matches merchant credits by pattern and label", () => {
    const cards = [
      {
        slug: "amex-platinum",
        name: "Amex Platinum",
        issuer: "American Express",
        lastScraped: "2025-01-01T00:00:00Z",
        merchantCredits: [
          {
            id: "amex-lulu",
            label: "$75 statement credit at lululemon each quarter",
            eligibleWhen: { merchantPatterns: ["lululemon", "lululemon.com"] },
            requiresEnrollment: true,
          },
        ],
      },
      {
        slug: "test-card",
        name: "Test Card",
        issuer: "Other",
        recurringCredits: [
          {
            id: "generic-credit",
            label: "Monthly credit for lululemon purchases",
          },
        ],
      },
      {
        slug: "no-match",
        name: "No Match Card",
        merchantCredits: [
          {
            id: "other-merchant",
            label: "Saks credit",
            eligibleWhen: { merchantPatterns: ["saks"] },
          },
        ],
      },
    ];

    const matches = findMerchantBenefitsInCards(cards, "Lululemon");
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.card.slug).sort()).toEqual(["amex-platinum", "test-card"]);
    expect(matches[0].credits.length).toBeGreaterThan(0);
  });

  test("returns empty when merchant is missing", () => {
    const matches = findMerchantBenefitsInCards([], "");
    expect(matches).toEqual([]);
  });
});
