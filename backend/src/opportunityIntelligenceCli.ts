import {
  buildOpportunityReport,
  detectOpportunities,
  generateOpportunityInsights,
  generateOpportunityTimeline,
  opportunityFixtureStates,
  simulateOpportunity,
} from "./services/opportunityIntelligenceService";

const command = process.argv[2] || "help";
const userId = process.argv[3] || "devUser";

function run() {
  const walletBenefitStates = opportunityFixtureStates(userId);
  const opportunities = detectOpportunities({ userId, walletBenefitStates });

  if (command === "list") {
    print({ userId, opportunities });
    return;
  }
  if (command === "timeline") {
    print({ userId, timeline: generateOpportunityTimeline(opportunities, walletBenefitStates) });
    return;
  }
  if (command === "simulate") {
    print({
      userId,
      simulations: opportunities.map(simulateOpportunity),
    });
    return;
  }
  if (command === "report") {
    print(buildOpportunityReport({ userId, walletBenefitStates }));
    return;
  }
  if (command === "test") {
    print({
      userId,
      ruleCount: opportunities.length,
      hasUnusedCredit: opportunities.some((item) => item.opportunityType.includes("credit")),
      hasTimeline: generateOpportunityTimeline(opportunities, walletBenefitStates).length > 0,
      insights: generateOpportunityInsights(opportunities),
    });
    return;
  }
  if (command === "benchmark") {
    const report = buildOpportunityReport({ userId, walletBenefitStates });
    print({
      userId,
      opportunityCount: report.opportunities.length,
      activeCount: report.totals.activeCount,
      estimatedValueRemainingUSD: report.totals.estimatedValueRemainingUSD,
      estimatedValueAtRiskUSD: report.totals.estimatedValueAtRiskUSD,
      topPriority: report.opportunities[0]?.priority || null,
    });
    return;
  }
  print({
    usage:
      "ts-node src/opportunityIntelligenceCli.ts list|timeline|simulate|report|test|benchmark [userId]",
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run();
