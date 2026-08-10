import {
  EDGE_CASE_REGISTRY,
  GOLDEN_DECISION_SCENARIOS,
  resetDecisionValidationForTests,
  validateDecisionObject,
} from "../src/services/decisionValidationService";
import type { DecisionObject } from "../src/services/decisionRuntimeService";

beforeEach(() => {
  resetDecisionValidationForTests();
});

describe("decisionValidationService", () => {
  test("validates a strong runtime decision and assigns a strong trust score", async () => {
    const validation = await validateDecisionObject(runtimeDecision());

    expect(validation.status).toBe("validated");
    expect(validation.overallResult).toBe("passed");
    expect(validation.trustScore).toBeGreaterThanOrEqual(82);
    expect(validation.trustScoreLevel).toMatch(/strong|excellent/);
    expect(validation.recommendationCorrectness.result).toBe("passed");
    expect(validation.evidenceCompleteness.result).toBe("passed");
    expect(validation.ruleConsistency.result).toBe("passed");
    expect(validation.edgeCases).toEqual([]);
  });

  test("flags confidence drift when high confidence has weak evidence", async () => {
    const validation = await validateDecisionObject(
      runtimeDecision({
        evidence: [],
        confidence: { score: 0.94, label: "high" },
      }),
    );

    expect(validation.status).toBe("needs_review");
    expect(validation.confidenceCalibration.result).toBe("warning");
    expect(validation.evidenceCompleteness.result).toBe("failed");
    expect(validation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CONFIDENCE_CALIBRATION_WARNING",
        }),
      ]),
    );
  });

  test("detects rule conflicts as validation failures", async () => {
    const validation = await validateDecisionObject(
      runtimeDecision({
        evidence: [
          ...runtimeDecision().evidence,
          {
            evidenceId: "ev_conflict",
            type: "RULE_CONFLICT",
            source: "validation_fixture",
            statement: "conflict: overlapping category rules selected different winners",
            effect: "excludes",
            confidence: 0.9,
            version: "test",
          },
        ],
      }),
    );

    expect(validation.overallResult).toBe("failed");
    expect(validation.ruleConsistency.result).toBe("failed");
    expect(validation.edgeCases).toContain("conflicting_rules");
  });

  test("detects merchant ambiguity and incomplete wallet edge cases", async () => {
    const validation = await validateDecisionObject(
      runtimeDecision({
        recommendationStatus: "no_recommendation",
        recommendation: {
          paymentMethodId: null,
          displayName: null,
          estimatedValue: null,
          currency: "USD",
          winningRule: null,
        },
        merchant: {
          name: "Unknown Shop",
          category: null,
          confidence: 0.35,
        },
        walletSnapshot: {
          source: "manual",
          cardSlugs: [],
          evaluatedCardCount: 0,
        },
      }),
    );

    expect(validation.status).toBe("needs_review");
    expect(validation.edgeCases).toEqual(
      expect.arrayContaining(["incomplete_wallet", "unknown_merchant"]),
    );
    expect(validation.walletCoverage.result).toBe("failed");
    expect(validation.merchantResolutionQuality.result).toBe("failed");
  });

  test("golden scenario and edge case registries cover required validation dimensions", () => {
    expect(GOLDEN_DECISION_SCENARIOS.map((scenario) => scenario.category)).toEqual(
      expect.arrayContaining([
        "grocery",
        "travel",
        "dining",
        "online_retail",
        "gas",
        "electronics",
        "streaming",
      ]),
    );
    expect(EDGE_CASE_REGISTRY.map((edgeCase) => edgeCase.edgeCaseId)).toEqual(
      expect.arrayContaining([
        "unknown_merchant",
        "incomplete_wallet",
        "missing_benefit_data",
        "conflicting_rules",
        "expired_benefit",
        "ambiguous_purchase_context",
      ]),
    );
  });
});

function runtimeDecision(
  overrides: Partial<DecisionObject> = {},
): DecisionObject {
  const decision: DecisionObject = {
    id: "pdec_test",
    decisionId: "pdec_test",
    requestId: "req_test",
    status: "replayable",
    recommendationStatus: "recommended",
    userId: null,
    partnerId: null,
    recommendation: {
      paymentMethodId: "amex-gold",
      displayName: "American Express Gold",
      estimatedValue: 5.71,
      currency: "USD",
      winningRule: "4x dining",
    },
    confidence: { score: 0.92, label: "high" },
    confidenceFactors: [
      {
        name: "Merchant Resolution",
        level: "high",
        score: 0.92,
        explanation: "Merchant resolved.",
      },
      {
        name: "Wallet Completeness",
        level: "high",
        score: 1,
        explanation: "Wallet complete.",
      },
      {
        name: "Rule Certainty",
        level: "high",
        score: 0.9,
        explanation: "Rule available.",
      },
      {
        name: "Data Freshness",
        level: "high",
        score: 0.9,
        explanation: "Versions pinned.",
      },
    ],
    alternatives: [],
    explanation: {
      summary: "American Express Gold has the highest verified value.",
      factors: ["4x dining rule matched."],
    },
    evidence: [
      {
        evidenceId: "ev_merchant",
        type: "MERCHANT_MATCH",
        source: "merchant_intelligence",
        statement: "Merchant resolved as Starbucks.",
        effect: "supports",
        confidence: 0.92,
        version: "test",
      },
      {
        evidenceId: "ev_wallet",
        type: "WALLET_EVALUATED",
        source: "wallet_service",
        statement: "Two wallet cards evaluated.",
        effect: "supports",
        confidence: 1,
        version: "test",
      },
      {
        evidenceId: "ev_rule",
        type: "WINNING_RULE",
        source: "decision_engine",
        statement: "4x dining rule selected the winner.",
        effect: "supports",
        confidence: 0.92,
        version: "test",
      },
    ],
    warnings: [],
    merchant: {
      name: "Starbucks",
      category: "dining",
      confidence: 0.92,
    },
    walletSnapshot: {
      source: "manual",
      cardSlugs: ["amex-gold", "capital-one-venture"],
      evaluatedCardCount: 2,
    },
    purchaseContext: {
      amount: 25,
      currency: "USD",
      checkoutStage: "payment",
      context: {},
    },
    ruleVersion: "rules_test",
    merchantRegistryVersion: "merchant_test",
    benefitRegistryVersion: "benefit_test",
    knowledgeVersion: "knowledge_test",
    decisionEngineVersion: "engine_test",
    generatedAt: "2026-08-09T00:00:00.000Z",
    latency: {
      merchantResolutionMs: null,
      engineMs: 10,
      evidenceGenerationMs: 2,
      totalMs: 12,
    },
    replayAvailable: true,
    decisionPolicy: "Wallet-first policy.",
    runtimeVersion: "decision-runtime-0.1.0",
    apiVersion: "v1",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    eventCount: 8,
    replayStatus: "replayable",
    validationStatus: "pending",
    validationId: null,
    trustScore: null,
    trustScoreLevel: null,
    validatedAt: null,
    history: [],
  };
  return { ...decision, ...overrides };
}
