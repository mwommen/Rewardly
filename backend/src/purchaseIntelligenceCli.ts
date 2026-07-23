import {
  buildPurchaseIntelligenceReport,
  classifyPurchaseItem,
  extractPurchaseIntelligence,
  purchaseFixture,
} from "./services/purchaseIntelligenceService";

const command = process.argv[2] || "help";
const fixtureName = process.argv[3] || "mixed";

function run() {
  if (command === "test") {
    const fixtures = [
      "amazon-electronics",
      "amazon-groceries",
      "amazon-gift-card",
      "apple",
      "best-buy-electronics",
      "target-groceries",
      "mixed",
      "unknown",
    ];
    print({
      fixtureCount: fixtures.length,
      results: fixtures.map((fixture) => ({
        fixture,
        dominantCategory:
          extractPurchaseIntelligence(purchaseFixture(fixture)).purchase
            .categoryDistribution[0]?.normalizedCategory || "unknown",
      })),
    });
    return;
  }
  if (command === "extract") {
    print(extractPurchaseIntelligence(purchaseFixture(fixtureName)));
    return;
  }
  if (command === "classify") {
    const name = process.argv.slice(3).join(" ") || "Apple MacBook Air laptop";
    print(classifyPurchaseItem({ name, price: 999 }));
    return;
  }
  if (command === "benchmark") {
    const report = buildPurchaseIntelligenceReport(purchaseFixture(fixtureName));
    print({
      fixture: fixtureName,
      itemCount: report.summary.itemCount,
      dominantCategory: report.summary.dominantCategory,
      confidence: report.summary.confidence,
      performance: report.performance,
    });
    return;
  }
  if (command === "report") {
    print(buildPurchaseIntelligenceReport(purchaseFixture(fixtureName)));
    return;
  }
  print({
    usage:
      "ts-node src/purchaseIntelligenceCli.ts test|extract|classify|benchmark|report [fixtureOrItem]",
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run();
