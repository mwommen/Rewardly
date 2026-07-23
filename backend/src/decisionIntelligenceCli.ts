import {
  buildDecisionConfidence,
  compareDecisionExplanations,
  createDecisionReplaySnapshot,
  explainRecommendationDecision,
  listDecisionAuditRecords,
  persistDecisionAuditRecord,
  replayDecisionSnapshot,
  type DecisionExplanationInput,
} from "./services/decisionIntelligenceService";
import { walletIntelligenceFixtureStates } from "./services/walletIntelligenceFixture";

const command = process.argv[2] || "help";

function fixtureInput(): DecisionExplanationInput {
  const states = walletIntelligenceFixtureStates();
  return {
    userId: "decision-demo-user",
    merchant: {
      name: "Lululemon",
      category: "apparel",
      mcc: "5651",
      confidence: 0.9,
      merchantId: "lululemon",
      matchingStrategy: "domain",
      aliasUsed: "lululemon.com",
    },
    wallet: {
      source: "manual",
      cardSlugs: ["amex-platinum", "amex-gold"],
      benefitStates: states,
    },
    recommendations: [
      {
        slug: "amex-platinum",
        name: "The Platinum Card from American Express",
        effectiveRate: 0.01,
        estValueUSD: 75.8,
        matchTier: "exact_benefit",
        matchedBenefit: "$75 statement credit at lululemon each quarter",
        matchedBenefitId: "amex-platinum:merchant-credit:amex-platinum-lululemon-credit",
        lastVerified: "2026-07-22T00:00:00.000Z",
        sourceUrl: "https://issuer.example/amex-platinum/lululemon",
        intelligenceConfidence: {
          score: 0.88,
          label: "high",
          factors: {
            matchQuality: 0.92,
            merchant: 0.9,
            benefitFreshness: 0.95,
            walletCompleteness: 0.78,
          },
          reasons: ["strong_internal_confidence"],
        },
      },
      {
        slug: "amex-gold",
        name: "American Express Gold Card",
        effectiveRate: 0.01,
        estValueUSD: 0.8,
        matchTier: "base_rate",
        matchedBenefit: null,
        matchedBenefitId: null,
        intelligenceConfidence: {
          score: 0.62,
          label: "medium",
          factors: {
            matchQuality: 0.55,
            merchant: 0.9,
            benefitFreshness: 0.45,
            walletCompleteness: 0.78,
          },
          reasons: ["weak_match_quality"],
        },
      },
    ],
    generatedAt: "2026-07-22T00:00:00.000Z",
  };
}

function run() {
  const input = fixtureInput();
  const explanation = explainRecommendationDecision(input);

  if (command === "explain") {
    print(explanation);
    return;
  }
  if (command === "confidence") {
    print(buildDecisionConfidence({
      recommendation: input.recommendations[0],
      merchantConfidence: input.merchant.confidence,
      walletStates: input.wallet.benefitStates,
    }));
    return;
  }
  if (command === "replay") {
    const snapshot = createDecisionReplaySnapshot(explanation, input);
    print(replayDecisionSnapshot(snapshot));
    return;
  }
  if (command === "audit") {
    const record = persistDecisionAuditRecord(explanation);
    print({ record, auditRecords: listDecisionAuditRecords() });
    return;
  }
  if (command === "compare") {
    const lowerConfidence = explainRecommendationDecision({
      ...input,
      merchant: { ...input.merchant, confidence: 0.45 },
    });
    print(compareDecisionExplanations(explanation, lowerConfidence));
    return;
  }

  print({
    usage:
      "ts-node src/decisionIntelligenceCli.ts explain|replay|confidence|audit|compare",
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run();
