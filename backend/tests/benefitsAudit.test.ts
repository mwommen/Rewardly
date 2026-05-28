import { buildBenefitsAudit } from "../src/benefitsAudit";

describe("buildBenefitsAudit", () => {
  test("flags cross-issuer and mixed-type suspicious benefits", () => {
    const report = buildBenefitsAudit([
      {
        slug: "amex-1",
        name: "Amex 1",
        issuer: "American Express",
        perks: ["Airport lounge access"],
        merchantCredits: [{ label: "$10 dining credit", amountUSD: 10, period: "month" }],
      },
      {
        slug: "chase-1",
        name: "Chase 1",
        issuer: "Chase",
        perks: ["Airport lounge access"],
        recurringCredits: [{ label: "Airport lounge access", amountUSD: 100, period: "year" }],
      },
    ]);

    expect(report.crossIssuerCount).toBeGreaterThan(0);
    expect(report.suspiciousBenefits[0]?.example).toBe("Airport lounge access");
    expect(report.suspiciousBenefits[0]?.reasons).toEqual(
      expect.arrayContaining([
        "appears across multiple issuers",
        "appears as both perk and credit",
      ])
    );
  });

  test("surfaces card-level QA issues", () => {
    const report = buildBenefitsAudit([
      {
        slug: "bad-card",
        name: "Bad Card",
        issuer: "Test",
        perks: ["window.__INITIAL_STATE__"],
        reviewStatus: "needs_review",
        scrapeQa: { needsReview: true, junkCount: 1, junkRatio: 0.5 },
      },
    ]);

    expect(report.cardIssues).toHaveLength(1);
    expect(report.cardIssues[0].slug).toBe("bad-card");
    expect(report.cardIssues[0].reasons).toEqual(
      expect.arrayContaining([
        "reviewStatus=needs_review",
        "scrapeQa.needsReview=true",
        "scrapeQa.junkCount=1",
        "contains junk perk text",
      ])
    );
  });

  test("does not flag expected shared baseline benefits as suspicious", () => {
    const report = buildBenefitsAudit([
      {
        slug: "card-a",
        name: "Card A",
        issuer: "Issuer A",
        perks: ["No annual fee"],
      },
      {
        slug: "card-b",
        name: "Card B",
        issuer: "Issuer B",
        perks: ["No annual fee"],
      },
    ]);

    expect(report.suspiciousBenefits.some((item) => item.example === "No annual fee")).toBe(false);
  });
});
