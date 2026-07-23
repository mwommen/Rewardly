import {
  PURCHASE_PERFORMANCE_TARGETS,
  buildPurchaseIntelligenceReport,
  calculateCategoryDistribution,
  classifyPurchaseItem,
  extractPurchaseIntelligence,
  purchaseFixture,
  selectCheckoutAdapter,
  toRecommendationPurchaseContext,
} from "../src/services/purchaseIntelligenceService";

describe("purchaseIntelligenceService", () => {
  test("extracts Amazon electronics with tax, shipping, discounts, and high confidence", () => {
    const report = extractPurchaseIntelligence(purchaseFixture("amazon-electronics"));

    expect(report.adapterId).toBe("amazon");
    expect(report.purchase.items[0]).toEqual(
      expect.objectContaining({
        normalizedCategory: "electronics",
        recommendationCategory: "Technology purchase",
        brand: "Apple",
      }),
    );
    expect(report.purchase).toEqual(
      expect.objectContaining({
        subtotal: 999,
        tax: 82.42,
        shipping: 0,
        discounts: 50,
        total: 1031.42,
      }),
    );
    expect(report.purchase.confidence.label).toBe("high");
    expect(Number.isNaN(Date.parse(report.purchase.extractedAt))).toBe(false);
  });

  test("classifies Amazon groceries, gift cards, subscriptions, and digital goods", () => {
    expect(
      extractPurchaseIntelligence(purchaseFixture("amazon-groceries")).purchase
        .items[0].normalizedCategory,
    ).toBe("groceries");
    const giftCard = extractPurchaseIntelligence(purchaseFixture("amazon-gift-card")).purchase;
    expect(giftCard.items[0].normalizedCategory).toBe("gift_card");
    expect(giftCard.exclusions).toContain("gift_card");
    expect(classifyPurchaseItem({ name: "Kindle ebook download", price: 12 })).toEqual(
      expect.objectContaining({
        normalizedCategory: "digital_goods",
        digitalOrPhysical: "digital",
      }),
    );
    expect(classifyPurchaseItem({ name: "Monthly streaming subscription", price: 20 })).toEqual(
      expect.objectContaining({
        normalizedCategory: "subscription",
        digitalOrPhysical: "digital",
        exclusions: expect.arrayContaining(["subscription"]),
      }),
    );
  });

  test("covers Apple, Best Buy, Target, fuel, pharmacy, restaurants, travel, and home improvement", () => {
    expect(extractPurchaseIntelligence(purchaseFixture("apple")).purchase.items[0].normalizedCategory).toBe("electronics");
    expect(extractPurchaseIntelligence(purchaseFixture("best-buy-electronics")).purchase.items[0].normalizedCategory).toBe("electronics");
    expect(extractPurchaseIntelligence(purchaseFixture("target-groceries")).purchase.items[0].normalizedCategory).toBe("groceries");
    expect(classifyPurchaseItem({ name: "Shell gasoline fuel", price: 45 }).normalizedCategory).toBe("fuel");
    expect(classifyPurchaseItem({ name: "CVS prescription pharmacy", price: 18 }).normalizedCategory).toBe("pharmacy");
    expect(classifyPurchaseItem({ name: "DoorDash restaurant order", price: 34 }).normalizedCategory).toBe("restaurant");
    expect(classifyPurchaseItem({ name: "Delta flight booking", price: 320 }).normalizedCategory).toBe("travel");
    expect(classifyPurchaseItem({ name: "Home Depot paint and lumber", price: 140 }).normalizedCategory).toBe("home_improvement");
  });

  test("supports mixed carts and category distribution", () => {
    const report = extractPurchaseIntelligence(purchaseFixture("mixed"));
    const categories = report.purchase.categoryDistribution.map(
      (item) => item.normalizedCategory,
    );

    expect(categories).toEqual(
      expect.arrayContaining([
        "electronics",
        "gift_card",
        "subscription",
        "groceries",
      ]),
    );
    expect(
      report.purchase.categoryDistribution.reduce((sum, item) => sum + item.share, 0),
    ).toBeCloseTo(1, 1);
    expect(
      calculateCategoryDistribution(report.purchase.items, report.purchase.subtotal)[0],
    ).toEqual(expect.objectContaining({ itemCount: expect.any(Number) }));
    const recommendationContext = toRecommendationPurchaseContext(report.purchase);
    expect(recommendationContext.materiallyMixed).toBe(true);
    expect(recommendationContext.refinement).toBe("mixed_cart_fallback");
    expect(recommendationContext.eligibleAmount).toBeLessThan(report.purchase.total!);
  });

  test("converts high-confidence purchase data into recommendation context", () => {
    const report = extractPurchaseIntelligence(purchaseFixture("amazon-groceries"));
    const context = toRecommendationPurchaseContext(report.purchase);

    expect(context).toEqual(
      expect.objectContaining({
        dominantCategory: "groceries",
        confidenceLabel: "high",
        materiallyMixed: false,
        refinement: "purchase_refined",
      }),
    );
  });

  test("handles unknown products with low confidence instead of silently influencing recommendations", () => {
    const report = extractPurchaseIntelligence(purchaseFixture("unknown"));

    expect(report.purchase.items[0].normalizedCategory).toBe("unknown");
    expect(["low", "medium"]).toContain(report.purchase.confidence.label);
    expect(report.purchase.items[0].confidence).toBeLessThan(0.5);
  });

  test("selects merchant checkout adapters without merchant-specific scoring", () => {
    expect(selectCheckoutAdapter({ hostname: "www.amazon.com" }).adapterId).toBe("amazon");
    expect(selectCheckoutAdapter({ hostname: "www.bestbuy.com" }).adapterId).toBe("best_buy");
    expect(selectCheckoutAdapter({ hostname: "unknown.example" }).adapterId).toBe("generic");
  });

  test("reports performance targets and deterministic benchmark output", () => {
    const report = buildPurchaseIntelligenceReport(purchaseFixture("mixed"));

    expect(PURCHASE_PERFORMANCE_TARGETS).toEqual(
      expect.objectContaining({
        purchaseExtractionMs: 300,
        categoryClassificationMs: 150,
        recommendationPipelineMs: 1000,
      }),
    );
    expect(report.performance.withinTargets).toBe(true);
    expect(report.summary).toEqual(
      expect.objectContaining({
        itemCount: 4,
        hasGiftCard: true,
        hasDigitalGoods: true,
      }),
    );
  });
});
