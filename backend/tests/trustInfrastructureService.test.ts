jest.mock("../src/services/paymentDecisionService", () => ({
  decidePayment: jest.fn(),
}));

import { decidePayment } from "../src/services/paymentDecisionService";
import {
  createOrResolveTrustRecord,
  formatConfidenceLabel,
  getCriticalWarnings,
  getTopAlternatives,
  groupEvidenceByType,
  replayDecision,
  resetTrustInfrastructureForTests,
} from "../src/services/trustInfrastructureService";

const mockedDecidePayment = decidePayment as jest.MockedFunction<
  typeof decidePayment
>;

describe("trustInfrastructureService", () => {
  beforeEach(() => {
    resetTrustInfrastructureForTests();
    jest.clearAllMocks();
  });

  test("creates a deterministic trust record from canonical decision output", async () => {
    const decision = mockDecision();
    const record = await createOrResolveTrustRecord({
      decisionId: "pdec_test",
      decision,
      normalizedRequest: mockRequest(),
    });
    const duplicate = await createOrResolveTrustRecord({
      decisionId: "pdec_test",
      decision,
      normalizedRequest: mockRequest(),
    });

    expect(record).toBe(duplicate);
    expect(record.trustRecordId).toMatch(/^trst_/);
    expect(record.status).toBe("complete");
    expect(record.recommendation.paymentMethodId).toBe("capital-one-venture");
    expect(record.explanation.primaryReason.code).toBe("BASE_REWARD_RULE_WON");
    expect(record.provenance.commercialBiasApplied).toBe(false);
    expect(record.reproducibility.replayable).toBe(true);
  });

  test("evidence is structured, deterministic, and free of raw sensitive fields", async () => {
    const record = await createOrResolveTrustRecord({
      decisionId: "pdec_evidence",
      decision: mockDecision(),
      normalizedRequest: mockRequest(),
    });

    expect(record.evidence.length).toBeGreaterThan(0);
    const secondRecord = await createOrResolveTrustRecord({
      decisionId: "pdec_evidence_second",
      decision: mockDecision(),
      normalizedRequest: mockRequest(),
    });
    expect(record.evidence.map((item) => item.evidenceId)).toEqual(
      secondRecord.evidence.map((item) => item.evidenceId),
    );
    expect(JSON.stringify(record.evidence)).not.toMatch(
      /cvv|cardNumber|accessToken/i,
    );
    expect(groupEvidenceByType(record.evidence).WALLET_OWNERSHIP).toBeDefined();
  });

  test("alternatives come from evaluated wallet cards and exclude the winner", async () => {
    const record = await createOrResolveTrustRecord({
      decisionId: "pdec_alternatives",
      decision: mockDecision(),
      normalizedRequest: mockRequest(),
    });

    expect(record.alternatives).toHaveLength(1);
    expect(record.alternatives[0]).toEqual(
      expect.objectContaining({
        paymentMethodId: "amex-gold",
        rank: 2,
      }),
    );
    expect(getTopAlternatives(record, 1)).toHaveLength(1);
  });

  test("confidence contract is normalized and helper formats the level", async () => {
    const record = await createOrResolveTrustRecord({
      decisionId: "pdec_confidence",
      decision: mockDecision(),
      normalizedRequest: mockRequest(),
    });

    expect(record.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(record.confidence.overall).toBeLessThanOrEqual(1);
    expect(formatConfidenceLabel(record.confidence)).toBe("High confidence");
    expect(getCriticalWarnings(record)).toEqual([]);
  });

  test("replay uses the canonical decision service and reports matches", async () => {
    mockedDecidePayment.mockResolvedValueOnce(mockDecision());
    await createOrResolveTrustRecord({
      decisionId: "pdec_replay",
      decision: mockDecision(),
      normalizedRequest: mockRequest(),
    });

    const replay = await replayDecision("pdec_replay");

    expect(replay.status).toBe("matched");
    expect(replay.originalRecommendationId).toBe("capital-one-venture");
    expect(replay.replayedRecommendationId).toBe("capital-one-venture");
    expect(mockedDecidePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: "Amazon",
        manualCardSlugs: ["capital-one-venture", "amex-gold"],
        restrictToWallet: true,
      }),
    );
    expect(mockedDecidePayment.mock.calls[0][0]).not.toHaveProperty("userId");
  });
});

function mockRequest() {
  return {
    userId: "pdec_test",
    merchant: "Amazon",
    category: "online_retail",
    amount: 142.83,
    manualCardSlugs: ["capital-one-venture", "amex-gold"],
    restrictToWallet: true,
    purchaseContext: {
      surface: "backend",
      amount: 142.83,
      currency: "USD",
      checkoutDetected: true,
      checkoutStage: "payment",
    },
  } as any;
}

function mockDecision() {
  return {
    recommendedCard: {
      card: {
        slug: "capital-one-venture",
        name: "Capital One Venture Rewards",
        issuer: "Capital One",
      },
      rewardEstimate: {
        label: "Earn 2x Venture Miles on eligible purchases.",
        estimatedValueUSD: 2.86,
      },
    },
    alternativeCards: [
      {
        card: { slug: "amex-gold", name: "American Express Gold" },
        rewardEstimate: { estimatedValueUSD: 1.43 },
        confidence: { score: 0.82 },
      },
    ],
    merchant: {
      name: "Amazon",
      category: "online_retail",
      confidence: 0.92,
    },
    primaryReason: {
      detail: "Highest verified earning rate among eligible wallet cards.",
    },
    winningReason: {
      type: "base_earning",
      explanation: "Earn 2x Venture Miles on this purchase.",
      estimatedValue: 2.86,
    },
    confidence: { score: 0.91, label: "high" },
    recommendationSummary: "Capital One Venture Rewards has the best value.",
    decisionNarrative: {
      reasonType: "base_earning",
      headline: "Use Capital One Venture Rewards",
      summary: "Earn 2x Venture Miles on this purchase.",
      primaryReason: {
        summary: "Earn 2x Venture Miles on this purchase.",
      },
      supportingReasons: [
        { summary: "Highest verified earning rate among wallet cards." },
      ],
    },
    generatedAt: "2026-08-05T12:00:00.000Z",
  } as any;
}
