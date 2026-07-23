import { scoreRecommendationConfidence } from "../src/services/recommendationConfidenceService";

describe("recommendationConfidenceService", () => {
  test("scores exact fresh benefit recommendations as high confidence", () => {
    const result = scoreRecommendationConfidence({
      matchTier: "exact_benefit",
      merchantConfidence: 0.94,
      benefitConfidence: 0.9,
      lastVerified: new Date().toISOString(),
      walletCardCount: 3,
      hasMatchedBenefit: true,
    });

    expect(result.label).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.reasons).toContain("strong_internal_confidence");
  });

  test("flags weak merchant and stale benefit context", () => {
    const result = scoreRecommendationConfidence({
      matchTier: "base_rate",
      merchantConfidence: 0.42,
      benefitConfidence: 0.5,
      lastVerified: "2023-01-01T00:00:00.000Z",
      walletCardCount: 1,
    });

    expect(result.label).toBe("low");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "weak_match_quality",
        "uncertain_merchant_mapping",
        "benefit_needs_reverification",
        "limited_wallet_context",
      ]),
    );
  });
});
