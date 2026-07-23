import {
  buildDecisionConfidence,
  compareDecisionExplanations,
  createDecisionReplaySnapshot,
  explainRecommendationDecision,
  persistDecisionAuditRecord,
  replayDecisionSnapshot,
  type DecisionExplanationInput,
} from "../src/services/decisionIntelligenceService";
import { canonicalizeWalletBenefitState } from "../src/services/walletIntelligenceService";

const BENEFIT_ID = "amex-platinum:merchant-credit:lululemon-credit";

function fixtureInput(overrides: Partial<DecisionExplanationInput> = {}): DecisionExplanationInput {
  const walletState = canonicalizeWalletBenefitState({
    userId: "u1",
    cardSlug: "amex-platinum",
    benefitId: BENEFIT_ID,
    enrollmentStatus: "enrolled",
    activationStatus: "not_required",
    remainingValue: 75,
    cycleValueLimit: 75,
    cycleFrequency: "quarterly",
    confidenceSource: "user_verified",
  });
  return {
    userId: "u1",
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
      benefitStates: [walletState],
    },
    recommendations: [
      {
        slug: "amex-platinum",
        name: "Amex Platinum",
        effectiveRate: 0.01,
        estValueUSD: 75.8,
        matchTier: "exact_benefit",
        matchedBenefit: "$75 statement credit at lululemon",
        matchedBenefitId: BENEFIT_ID,
        lastVerified: "2026-07-22T00:00:00.000Z",
        sourceUrl: "https://issuer.example/platinum/lululemon",
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
        name: "Amex Gold",
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
    ...overrides,
  };
}

describe("decisionIntelligenceService", () => {
  test("generates a canonical explanation with structured merchant, benefit, wallet, scoring, and confidence evidence", () => {
    const explanation = explainRecommendationDecision(fixtureInput());

    expect(explanation).toEqual(
      expect.objectContaining({
        decisionId: expect.stringMatching(/^decision_/),
        recommendationId: expect.stringMatching(/^recommendation_/),
        userId: "u1",
        merchantId: "lululemon",
        selectedCardId: "amex-platinum",
        selectedBenefitId: BENEFIT_ID,
        explanationVersion: expect.any(String),
        replayHash: expect.stringMatching(/^decision-replay_/),
      }),
    );
    expect(explanation.evidence.merchant).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "resolved_merchant" }),
      ]),
    );
    expect(explanation.evidence.wallet).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "wallet_benefit_state" }),
      ]),
    );
    expect(explanation.evidence.scoring).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "estimated_value_usd" }),
      ]),
    );
    expect(explanation.recommendationConfidence.components.walletState).toBe(0.9);
  });

  test("confidence uses weighted components and surfaces low-confidence reasons", () => {
    const confidence = buildDecisionConfidence({
      recommendation: {
        slug: "unknown",
        matchTier: "base_rate",
        matchedBenefitId: null,
      },
      merchantConfidence: 0.4,
      walletStates: [],
    });

    expect(confidence.weights).toEqual(
      expect.objectContaining({
        matchQuality: expect.any(Number),
        merchantResolution: expect.any(Number),
        walletState: expect.any(Number),
      }),
    );
    expect(confidence.label).toBe("low");
    expect(confidence.reasons).toEqual(
      expect.arrayContaining(["merchant_resolution_uncertain"]),
    );
  });

  test("missing wallet state, unknown merchant, and stale benefit data are explicit", () => {
    const input = fixtureInput({
      merchant: {
        name: "Unknown Store",
        category: "other",
        confidence: 0.35,
      },
      wallet: {
        source: "manual",
        cardSlugs: ["amex-platinum"],
        benefitStates: [],
      },
      recommendations: [
        {
          slug: "amex-platinum",
          name: "Amex Platinum",
          matchTier: "exact_benefit",
          matchedBenefit: "$75 statement credit",
          matchedBenefitId: BENEFIT_ID,
        },
      ],
    });

    const explanation = explainRecommendationDecision(input);

    expect(explanation.missingInformation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LOW_MERCHANT_CONFIDENCE" }),
        expect.objectContaining({ code: "WALLET_STATE_UNAVAILABLE" }),
        expect.objectContaining({ code: "BENEFIT_VERIFICATION_DATE_UNKNOWN" }),
      ]),
    );
    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LOW_RECOMMENDATION_CONFIDENCE" }),
      ]),
    );
  });

  test("records competing cards and explains why alternatives lost", () => {
    const explanation = explainRecommendationDecision(fixtureInput());

    expect(explanation.alternativeCards).toEqual([
      expect.objectContaining({
        cardId: "amex-gold",
        whyItLost: "Lower estimated value than the selected card.",
      }),
    ]);
  });

  test("replay is deterministic and audit records are immutable", () => {
    const input = fixtureInput();
    const explanation = explainRecommendationDecision(input);
    const snapshot = createDecisionReplaySnapshot(explanation, input);
    const replay = replayDecisionSnapshot(snapshot);
    const record = persistDecisionAuditRecord(explanation);

    expect(replay).toEqual(
      expect.objectContaining({
        matched: true,
        selectedCardId: "amex-platinum",
        expectedSelectedCardId: "amex-platinum",
      }),
    );
    expect(record).toEqual(
      expect.objectContaining({
        immutable: true,
        explanation,
      }),
    );
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.explanation)).toBe(true);
  });

  test("comparison flags benefit version changes through explanation hashes", () => {
    const first = explainRecommendationDecision(fixtureInput());
    const second = explainRecommendationDecision(
      fixtureInput({
        recommendations: [
          {
            ...fixtureInput().recommendations[0],
            matchedBenefitId: "amex-platinum:merchant-credit:lululemon-credit-v2",
            estValueUSD: 100,
          },
        ],
      }),
    );

    expect(compareDecisionExplanations(first, second)).toEqual(
      expect.objectContaining({
        sameSelectedCard: true,
        sameSelectedBenefit: false,
        replayHashChanged: true,
      }),
    );
  });
});
