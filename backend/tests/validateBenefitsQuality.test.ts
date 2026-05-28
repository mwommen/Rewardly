import { validateBenefitsQuality } from "../src/validateBenefitsQuality";

describe("validateBenefitsQuality", () => {
  test("passes clean cards", () => {
    const failures = validateBenefitsQuality([
      {
        slug: "clean-card",
        perks: ["No foreign transaction fees", "Purchase protection"],
        merchantCredits: [
          { label: "$10 monthly dining credit", amountUSD: 10, period: "month" },
        ],
        recurringCredits: [
          { label: "$100 annual hotel credit", amountUSD: 100, period: "year" },
        ],
        reviewStatus: "ok",
        scrapeQa: { needsReview: false, junkCount: 0, junkRatio: 0 },
      },
    ]);

    expect(failures).toEqual([]);
  });

  test("flags junk, duplicates, and invalid credits", () => {
    const failures = validateBenefitsQuality([
      {
        slug: "bad-card",
        perks: [
          "window.__INITIAL_STATE__",
          "Priority Pass lounge access",
          "Priority Pass lounge access",
          "VIP",
        ],
        merchantCredits: [
          { label: "$10 monthly dining credit", amountUSD: 10, period: "month" },
          { label: "$10 monthly dining credit", amountUSD: 10, period: "month" },
          { label: "x", amountUSD: 0, period: "week" },
        ],
        recurringCredits: [
          { label: "window.__INITIAL_STATE__", amountUSD: 12, period: "month" },
        ],
        reviewStatus: "needs_review",
        scrapeQa: { needsReview: true, junkCount: 2, junkRatio: 0.4 },
      },
    ]);

    const reasons = failures.map((f) => f.reason);

    expect(reasons).toContain("marked needs_review");
    expect(reasons).toContain("scrapeQa flagged needsReview");
    expect(reasons).toContain("scrapeQa junkCount=2");
    expect(reasons).toContain("scrapeQa junkRatio=0.40");
    expect(reasons).toContain("1 junk perk lines");
    expect(reasons).toContain("1 perks too short");
    expect(reasons).toContain("1 duplicate perk lines");
    expect(reasons).toContain("1 junk credit lines");
    expect(reasons).toContain("1 duplicate credit lines");
    expect(reasons).toContain("merchant credit: credit label too short");
    expect(reasons).toContain("recurring credit: credit label looks like junk");
  });

  test("treats trademark suffix variants as duplicate labels", () => {
    const failures = validateBenefitsQuality([
      {
        slug: "trademark-card",
        recurringCredits: [
          { label: "$50 Annual Chase TravelSM Hotel Credit", amountUSD: 50, period: "year" },
          { label: "$50 Annual Chase Travel Hotel Credit", amountUSD: 50, period: "year" },
        ],
        reviewStatus: "ok",
        scrapeQa: { needsReview: false, junkCount: 0, junkRatio: 0 },
      },
    ]);

    expect(failures.map((failure) => failure.reason)).toContain("1 duplicate credit lines");
  });
});
