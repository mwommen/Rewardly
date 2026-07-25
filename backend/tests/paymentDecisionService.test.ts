jest.mock("../src/services/walletService", () => ({
  resolveUserWallet: jest.fn(),
}));

jest.mock("../src/services/recommendationService", () => ({
  recommendBestCards: jest.fn(),
  recommendAllBenefits: jest.fn(),
}));

jest.mock("../src/services/merchantDetectionService", () => ({
  resolveMerchant: jest.fn(() => ({
    name: "Amazon",
    category: "online_shopping",
    mcc: "5942",
    confidence: 0.9,
  })),
}));

import { decidePayment } from "../src/services/paymentDecisionService";
import { resolveUserWallet } from "../src/services/walletService";
import {
  buildRecommendation,
  createPaymentDecision,
  validateRecommendationIntegrity,
  type RecommendationWinningReason,
  type Wallet,
} from "../../packages/rewardly-core/src";
import {
  recommendAllBenefits,
  recommendBestCards,
} from "../src/services/recommendationService";
import { resolveMerchant } from "../src/services/merchantDetectionService";

const mockedResolveUserWallet = resolveUserWallet as jest.MockedFunction<
  typeof resolveUserWallet
>;
const mockedRecommendBestCards = recommendBestCards as jest.MockedFunction<
  typeof recommendBestCards
>;
const mockedRecommendAllBenefits = recommendAllBenefits as jest.Mock;
const mockedResolveMerchant = resolveMerchant as jest.MockedFunction<
  typeof resolveMerchant
>;

describe("paymentDecisionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveMerchant.mockReturnValue({
      name: "Amazon",
      category: "online_shopping",
      mcc: "5942",
      confidence: 0.9,
    });
  });

  test("empty wallet returns no-wallet decision and does not score every card", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "empty-user",
      cards: [],
      cardSlugs: [],
      source: "empty",
      benefitStates: [],
    });

    const decision = await decidePayment({
      userId: "empty-user",
      merchant: "Amazon",
      restrictToWallet: true,
    });

    expect(decision.recommendedCard).toBeNull();
    expect(decision.recommendationSummary).toBe(
      "Add cards to your wallet to get personalized recommendations.",
    );
    expect(mockedRecommendBestCards).not.toHaveBeenCalled();
    expect(mockedRecommendAllBenefits).not.toHaveBeenCalled();
  });

  test("restrictToWallet true passes wallet card slugs into scoring", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "gold-user",
      cards: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
        },
      ],
      cardSlugs: ["amex-gold"],
      source: "manual",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      recommendations: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
          effectiveRate: 0.04,
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      offers: [],
    });

    const decision = await decidePayment({
      userId: "gold-user",
      merchant: "Amazon",
      restrictToWallet: true,
    });

    expect(decision.recommendedCard?.card.slug).toBe("amex-gold");
    expect(mockedRecommendBestCards).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: ["amex-gold"] }),
    );
    expect(mockedRecommendAllBenefits).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: ["amex-gold"] }),
    );
  });

  test("restrictToWallet false can still score full catalog for demo/search flows", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "demo-user",
      cards: [
        { slug: "amex-gold", name: "Amex Gold", issuer: "American Express" },
        {
          slug: "chase-sapphire-reserve",
          name: "Chase Sapphire Reserve",
          issuer: "Chase",
        },
      ],
      cardSlugs: ["amex-gold", "chase-sapphire-reserve"],
      source: "empty",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      recommendations: [
        {
          slug: "chase-sapphire-reserve",
          name: "Chase Sapphire Reserve",
          issuer: "Chase",
          effectiveRate: 0.1,
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      offers: [],
    });

    const decision = await decidePayment({
      userId: "demo-user",
      merchant: "Amazon",
      restrictToWallet: false,
    });

    expect(decision.recommendedCard?.card.slug).toBe("chase-sapphire-reserve");
    expect(mockedRecommendBestCards).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: undefined }),
    );
    expect(mockedRecommendAllBenefits).toHaveBeenCalledWith(
      expect.objectContaining({ allowedCardSlugs: undefined }),
    );
  });

  test("preserves internal recommendation confidence without exposing new UI fields", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "gold-user",
      cards: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
        },
      ],
      cardSlugs: ["amex-gold"],
      source: "manual",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      recommendations: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
          effectiveRate: 0.04,
          intelligenceConfidence: {
            score: 0.84,
            label: "high",
            reasons: ["strong_internal_confidence"],
          },
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 0,
      categoriesUsed: ["online_shopping"],
      offers: [],
    });

    const decision = await decidePayment({
      userId: "gold-user",
      merchant: "Amazon",
      restrictToWallet: true,
    });

    expect(decision.confidence).toEqual({ score: 0.84, label: "high" });
    expect(decision.recommendedCard?.confidence?.reasons).toEqual([
      "strong_internal_confidence",
    ]);
  });

  test("explains Amazon Venture recommendation with exact miles earning details", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "venture-user",
      cards: [
        {
          slug: "capital-one-venture",
          name: "Capital One Venture Rewards",
          issuer: "Capital One",
          perks: [
            "2x miles on every purchase",
            "$250 Capital One Travel credit (one-time)",
          ],
        },
      ],
      cardSlugs: ["capital-one-venture"],
      source: "manual",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 32.51,
      categoriesUsed: ["online_shopping"],
      recommendations: [
        {
          slug: "capital-one-venture",
          name: "Capital One Venture Rewards",
          issuer: "Capital One",
          effectiveRate: 0.02,
          estValueUSD: 0.65,
          matchTier: "base_rate",
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 32.51,
      categoriesUsed: ["online_shopping"],
      offers: [
        {
          slug: "capital-one-venture",
          name: "Capital One Venture Rewards",
          issuer: "Capital One",
          perks: [
            "2x miles on every purchase",
            "$250 Capital One Travel credit (one-time)",
          ],
        },
      ],
    });

    const decision = await decidePayment({
      userId: "venture-user",
      merchant: "Amazon",
      amount: 32.51,
      restrictToWallet: true,
    });

    expect(decision.winningReason).toEqual(
      expect.objectContaining({
        type: "catch_all_reward",
        merchantName: "Amazon",
        title: "2x miles on every purchase",
        explanation: "Earn 2x Venture Miles on this Amazon purchase.",
        applicableToPurchase: true,
        influencedRecommendation: true,
      }),
    );
    expect(decision.rewardEstimate?.label).toBe("2x miles on every purchase");
    expect(decision.primaryReason?.detail).toBe(
      "Earn 2x Venture Miles on this Amazon purchase.",
    );
    expect(decision.relevantBenefits?.map((match) => match.benefit.label)).toEqual([
      "2x miles on every purchase",
    ]);
    expect(decision.decisionNarrative).toEqual(
      expect.objectContaining({
        merchant: "Amazon",
        purchaseAmount: 32.51,
        reasonType: "catch_all_reward",
        headline: "Earn 2x Venture Miles on this Amazon purchase.",
        summary:
          "Highest verified earning rate among the eligible cards in your wallet.",
        earningText: "2x Venture Miles",
        estimatedReward: "About 65 Venture Miles on this $32.51 purchase.",
        estimatedRewardText: "About 65 Venture Miles on this $32.51 purchase.",
        estimatedRewardUnit: "miles",
        reward: expect.objectContaining({
          type: "miles",
          programName: "Venture Miles",
          earningRate: 2,
          earningUnit: "miles_per_dollar",
          estimatedRewardQuantity: 65.02,
          purchaseAmount: 32.51,
        }),
        rewardDetails: expect.objectContaining({
          rate: 2,
          unit: "miles_per_dollar",
          programName: "Venture Miles",
          estimatedQuantity: 65.02,
          displayQuantity: "65 Venture Miles",
          purchaseAmount: 32.51,
          estimatedDisplay: "About 65 Venture Miles on this $32.51 purchase.",
        }),
        reasonText:
          "Highest verified earning rate among the eligible cards in your wallet.",
        comparison: null,
        comparisonText: null,
        confidence: "HIGH",
        primaryReason: expect.objectContaining({
          type: "catch_all_reward",
          headline: "Earn 2x Venture Miles on this Amazon purchase.",
          ruleId: "capital-one-venture:catch_all_reward",
          benefitId: null,
          scoreContribution: 0.65,
        }),
      }),
    );
    expect(JSON.stringify(decision)).not.toMatch(
      /Capital One Travel credit|2% value|2% eligible rewards/i,
    );
  });

  test("explains a generic Apple Venture recommendation from the reusable 2x base rule", async () => {
    mockedResolveMerchant.mockReturnValueOnce({
      name: "Apple",
      category: "online_shopping",
      mcc: "5732",
      confidence: 0.9,
    });
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "venture-user",
      cards: [
        {
          slug: "capital-one-venture",
          name: "Capital One Venture Rewards",
          issuer: "Capital One",
          perks: ["2x miles on every purchase"],
        },
      ],
      cardSlugs: ["capital-one-venture"],
      source: "manual",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Apple",
      amount: 1211.65,
      categoriesUsed: ["online_shopping"],
      recommendations: [
        {
          slug: "capital-one-venture",
          name: "Capital One Venture Rewards",
          issuer: "Capital One",
          effectiveRate: 0.02,
          estValueUSD: 24.23,
          matchTier: "base_rate",
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Apple",
      amount: 1211.65,
      categoriesUsed: ["online_shopping"],
      offers: [],
    });

    const decision = await decidePayment({
      userId: "venture-user",
      merchant: "Apple",
      amount: 1211.65,
      restrictToWallet: true,
    });

    expect(decision.winningReason).toEqual(
      expect.objectContaining({
        type: "catch_all_reward",
        sourceRuleId: "capital-one-venture:catch_all_reward",
        explanation: "Earn 2x Venture Miles on this Apple purchase.",
      }),
    );
    expect(decision.decisionNarrative).toEqual(
      expect.objectContaining({
        merchant: "Apple",
        headline: "Earn 2x Venture Miles on this Apple purchase.",
        earningText: "2x Venture Miles",
        estimatedRewardText:
          "About 2423 Venture Miles on this $1211.65 purchase.",
        reasonText:
          "Highest verified earning rate among the eligible cards in your wallet.",
        reward: expect.objectContaining({
          type: "miles",
          programName: "Venture Miles",
          earningRate: 2,
          earningUnit: "miles_per_dollar",
          purchaseAmount: 1211.65,
          estimatedRewardQuantity: 2423.3,
        }),
      }),
    );
    expect(decision.recommendationIntegrity).toEqual(
      expect.objectContaining({
        valid: true,
        expectedRuleId: "capital-one-venture:catch_all_reward",
        expectedReasonType: "catch_all_reward",
      }),
    );
    expect(JSON.stringify(decision)).not.toMatch(
      /Verified wallet rewards|Calculated after checkout total|Capital One Travel credit/i,
    );
  });

  test("passes normalized purchase context into recommendation scoring", async () => {
    mockedResolveUserWallet.mockResolvedValueOnce({
      userId: "gold-user",
      cards: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
        },
      ],
      cardSlugs: ["amex-gold"],
      source: "manual",
      benefitStates: [],
    });
    mockedRecommendBestCards.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 42,
      categoriesUsed: ["groceries"],
      recommendations: [
        {
          slug: "amex-gold",
          name: "Amex Gold",
          issuer: "American Express",
          effectiveRate: 0.04,
        },
      ],
    } as any);
    mockedRecommendAllBenefits.mockResolvedValueOnce({
      merchant: "Amazon",
      amount: 42,
      categoriesUsed: ["groceries"],
      offers: [],
    });

    const purchase = {
      purchaseId: "purchase-test",
      merchantId: "amazon",
      subtotal: 42,
      tax: null,
      shipping: null,
      discounts: null,
      total: 42,
      currency: "USD",
      checkoutProvider: "amazon",
      confidence: { score: 0.92, label: "high" as const },
      items: [
        {
          itemId: "item-1",
          name: "Whole Foods groceries",
          quantity: 1,
          price: 42,
          category: null,
          merchantCategory: null,
          normalizedCategory: "groceries" as const,
          recommendationCategory: "Groceries",
          brand: null,
          digitalOrPhysical: "physical" as const,
          exclusions: [],
          confidence: 0.9,
        },
      ],
      categoryDistribution: [
        {
          normalizedCategory: "groceries" as const,
          itemCount: 1,
          estimatedAmount: 42,
          share: 1,
        },
      ],
      exclusions: [],
      extractedAt: new Date().toISOString(),
    };

    const decision = await decidePayment({
      userId: "gold-user",
      merchant: "Amazon",
      restrictToWallet: true,
      purchaseContext: {
        surface: "extension",
        purchase,
      },
    });

    expect(decision.purchase?.purchaseId).toBe("purchase-test");
    expect(decision.recommendationPurchaseContext).toEqual(
      expect.objectContaining({
        dominantCategory: "groceries",
        refinement: "purchase_refined",
      }),
    );
    expect(mockedRecommendBestCards).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 42,
        recommendationPurchaseContext: expect.objectContaining({
          dominantCategory: "groceries",
        }),
      }),
    );
    expect(mockedRecommendAllBenefits).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendationPurchaseContext: expect.objectContaining({
          dominantCategory: "groceries",
        }),
      }),
    );
  });

  describe("Recommendation Integrity Validator", () => {
    const merchant = {
      name: "Amazon",
      category: "online_shopping",
      mcc: "5942",
      confidence: 0.9,
    };
    const wallet = {
      userId: "integrity-user",
      source: "manual",
      cardSlugs: ["capital-one-venture"],
      cards: [
        {
          slug: "capital-one-venture",
          name: "Capital One Venture Rewards",
          issuer: "Capital One",
          perks: ["2x miles on every purchase"],
        },
      ],
    } satisfies Wallet;

    function recommendationFor(reason: RecommendationWinningReason) {
      return buildRecommendation({
        card: wallet.cards[0],
        primaryReason: {
          label: "Why this wins",
          detail: reason.explanation,
          kind: reason.type.includes("reward") ? "reward" : "benefit",
        },
        rewardEstimate: {
          label: reason.title,
          effectiveRate: reason.rewardRate,
          estimatedValueUSD: reason.estimatedValue,
        },
        confidence: { score: 0.91, label: "high" },
        unlockedBenefits: [],
        relevantBenefits: [],
        winningReason: reason,
      });
    }

    test.each([
      {
        name: "merchant rewards",
        amount: 32.51,
        reason: {
          type: "merchant_reward",
          merchantName: "Amazon",
          title: "5% back at Amazon",
          explanation: "Earn 5% back on this Amazon purchase.",
          rewardRate: 0.05,
          rewardUnit: "cash",
          estimatedValue: 1.63,
          applicableToPurchase: true,
          influencedRecommendation: true,
          sourceRuleId: "prime-visa:amazon_merchant_reward",
        } satisfies RecommendationWinningReason,
        expectedType: "merchant_reward",
        expectedHeadline: "Earn 5% back on this Amazon purchase.",
        expectedEstimatedReward: "About $1.63 back on this $32.51 purchase.",
        expectedRewardDetails: {
          rate: 5,
          unit: "cash_back_percent",
          estimatedCashBack: 1.63,
          displayCashBack: "$1.63",
        },
        expectedReward: {
          type: "cash_back",
          programName: "cash back",
          earningRate: 5,
          earningUnit: "percent_back",
          estimatedRewardCashValue: 1.63,
        },
        expectedEarningText: "5% cash back",
      },
      {
        name: "category bonuses",
        amount: 80,
        reason: {
          type: "category_reward",
          merchantName: "dining",
          title: "4x points at restaurants",
          explanation: "Earn 4x Membership Rewards points on this dining purchase.",
          rewardRate: 0.04,
          rewardUnit: "points",
          estimatedValue: 3.2,
          applicableToPurchase: true,
          influencedRecommendation: true,
          sourceRuleId: "amex-gold:dining_category_reward",
        } satisfies RecommendationWinningReason,
        expectedType: "category_bonus",
        expectedHeadline:
          "Earn 4x Membership Rewards points on this dining purchase.",
        expectedEstimatedReward:
          "About 320 Membership Rewards points on this $80 purchase.",
        expectedRewardDetails: {
          rate: 4,
          unit: "points_per_dollar",
          estimatedQuantity: 320,
          displayQuantity: "320 Membership Rewards points",
        },
        expectedReward: {
          type: "points",
          programName: "Membership Rewards points",
          earningRate: 4,
          earningUnit: "points_per_dollar",
          estimatedRewardQuantity: 320,
        },
        expectedEarningText: "4x Membership Rewards points",
      },
      {
        name: "Freedom Flex rotating cash back",
        amount: 50,
        reason: {
          type: "rotating_category",
          merchantName: "groceries",
          title: "5% cash back in rotating grocery categories",
          explanation: "Earn 5% back on this groceries purchase.",
          rewardRate: 0.05,
          rewardUnit: "cash",
          estimatedValue: 2.5,
          applicableToPurchase: true,
          influencedRecommendation: true,
          sourceRuleId: "chase-freedom-flex:grocery_rotating_reward",
        } satisfies RecommendationWinningReason,
        expectedType: "rotating_category",
        expectedHeadline: "Earn 5% back on this groceries purchase.",
        expectedEstimatedReward: "About $2.50 back on this $50 purchase.",
        expectedRewardDetails: {
          rate: 5,
          unit: "cash_back_percent",
          estimatedCashBack: 2.5,
          displayCashBack: "$2.50",
        },
        expectedReward: {
          type: "cash_back",
          programName: "cash back",
          earningRate: 5,
          earningUnit: "percent_back",
          estimatedRewardCashValue: 2.5,
        },
        expectedEarningText: "5% cash back",
      },
      {
        name: "Sapphire Preferred Ultimate Rewards",
        amount: 120,
        reason: {
          type: "category_reward",
          merchantName: "travel",
          title: "3x Ultimate Rewards points on travel",
          explanation: "Earn 3x Ultimate Rewards points on this travel purchase.",
          rewardRate: 0.03,
          rewardUnit: "points",
          estimatedValue: 3.6,
          applicableToPurchase: true,
          influencedRecommendation: true,
          sourceRuleId: "chase-sapphire-preferred:travel_category_reward",
        } satisfies RecommendationWinningReason,
        expectedType: "category_bonus",
        expectedHeadline:
          "Earn 3x Ultimate Rewards points on this travel purchase.",
        expectedEstimatedReward:
          "About 360 Ultimate Rewards points on this $120 purchase.",
        expectedRewardDetails: {
          rate: 3,
          unit: "points_per_dollar",
          estimatedQuantity: 360,
          displayQuantity: "360 Ultimate Rewards points",
        },
        expectedReward: {
          type: "points",
          programName: "Ultimate Rewards points",
          earningRate: 3,
          earningUnit: "points_per_dollar",
          estimatedRewardQuantity: 360,
        },
        expectedEarningText: "3x Ultimate Rewards points",
      },
      {
        name: "statement credits",
        amount: 100,
        merchantOverride: {
          name: "Lululemon",
          category: "apparel",
          mcc: "5651",
          confidence: 0.9,
        },
        reason: {
          type: "merchant_credit",
          merchantName: "Lululemon",
          title: "$75 Lululemon statement credit",
          explanation:
            "$75 Lululemon statement credit applies to this purchase.",
          estimatedValue: 75,
          applicableToPurchase: true,
          influencedRecommendation: true,
          sourceBenefitId: "amex-platinum-lululemon-credit",
        } satisfies RecommendationWinningReason,
        expectedType: "statement_credit",
        expectedHeadline:
          "This purchase qualifies for your $75 Lululemon statement credit.",
        expectedEstimatedReward: "Up to $75 back.",
        expectedRewardDetails: {
          unit: "statement_credit",
          creditAmount: 75,
          applicableCreditAmount: 75,
        },
        expectedReward: {
          type: "statement_credit",
          earningRate: 75,
          earningUnit: "flat_credit",
          estimatedRewardCashValue: 75,
        },
        expectedEarningText: "$75 statement credit",
      },
      {
        name: "catch-all rewards",
        amount: 32.51,
        reason: {
          type: "catch_all_reward",
          merchantName: "Amazon",
          title: "2x miles on every purchase",
          explanation: "Earn 2x Venture Miles on this Amazon purchase.",
          rewardRate: 0.02,
          rewardUnit: "miles",
          estimatedValue: 0.63,
          applicableToPurchase: true,
          influencedRecommendation: true,
          sourceRuleId: "capital-one-venture:catch_all_reward",
        } satisfies RecommendationWinningReason,
        expectedType: "catch_all_reward",
        expectedHeadline: "Earn 2x Venture Miles on this Amazon purchase.",
        expectedEstimatedReward: "About 65 Venture Miles on this $32.51 purchase.",
        expectedRewardDetails: {
          rate: 2,
          unit: "miles_per_dollar",
          estimatedQuantity: 65.02,
          displayQuantity: "65 Venture Miles",
        },
        expectedReward: {
          type: "miles",
          programName: "Venture Miles",
          earningRate: 2,
          earningUnit: "miles_per_dollar",
          estimatedRewardQuantity: 65.02,
        },
        expectedEarningText: "2x Venture Miles",
      },
    ])(
      "accepts a narrative that matches the winning $name rule",
      ({
        amount,
        reason,
        expectedType,
        expectedHeadline,
        expectedEstimatedReward,
        expectedRewardDetails,
        expectedReward,
        expectedEarningText,
        merchantOverride,
      }) => {
        const recommendation = recommendationFor(reason);
        const decision = createPaymentDecision({
          wallet,
          merchant: merchantOverride || merchant,
          recommendations: [recommendation],
          purchaseAmount: amount,
        });

        expect(decision.recommendationIntegrity).toEqual(
          expect.objectContaining({
            valid: true,
            fallbackApplied: false,
            expectedReasonType: expectedType,
          }),
        );
        expect(decision.decisionNarrative?.primaryReason).toEqual(
          expect.objectContaining({
            type: expectedType,
            ruleId: reason.sourceRuleId || null,
            benefitId: reason.sourceBenefitId || null,
          }),
        );
        expect(decision.decisionNarrative?.headline).toBe(expectedHeadline);
        expect(decision.decisionNarrative?.estimatedReward).toBe(
          expectedEstimatedReward,
        );
        expect(decision.decisionNarrative?.estimatedRewardText).toBe(
          expectedEstimatedReward,
        );
        expect(decision.decisionNarrative?.earningText).toBe(expectedEarningText);
        expect(decision.decisionNarrative?.reward).toEqual(
          expect.objectContaining(expectedReward),
        );
        expect(decision.decisionNarrative?.rewardDetails).toEqual(
          expect.objectContaining(expectedRewardDetails),
        );
        expect(JSON.stringify(decision.decisionNarrative)).not.toMatch(
          /eligible rewards|enhanced rewards|better rewards|higher value|eligible benefit|strongest value/i,
        );
      },
    );

    test("shows a high-confidence comparison only when a runner-up exists", () => {
      const winnerReason = {
        type: "catch_all_reward",
        merchantName: "Amazon",
        title: "2x miles on every purchase",
        explanation: "Earn 2x Venture Miles on this Amazon purchase.",
        rewardRate: 0.02,
        rewardUnit: "miles",
        estimatedValue: 0.65,
        applicableToPurchase: true,
        influencedRecommendation: true,
        sourceRuleId: "capital-one-venture:catch_all_reward",
      } satisfies RecommendationWinningReason;
      const runnerUp = buildRecommendation({
        card: {
          slug: "flat-one-mile-card",
          name: "Flat One Mile Card",
          issuer: "Test",
          perks: ["1x miles on every purchase"],
        },
        primaryReason: {
          label: "Why this wins",
          detail: "Earn 1x miles on this Amazon purchase.",
          kind: "reward",
        },
        rewardEstimate: {
          label: "1x miles on every purchase",
          effectiveRate: 0.01,
          estimatedValueUSD: 0.33,
        },
        confidence: { score: 0.91, label: "high" },
        unlockedBenefits: [],
      });

      const decision = createPaymentDecision({
        wallet,
        merchant,
        recommendations: [recommendationFor(winnerReason), runnerUp],
        purchaseAmount: 32.51,
      });

      expect(decision.decisionNarrative?.comparisonText).toBe(
        "Earn about 33 more miles than your next-best card.",
      );
      expect(decision.decisionNarrative?.comparison).toBe(
        "Earn about 33 more miles than your next-best card.",
      );
    });

    test("uses the safe fallback when the reward unit is unknown", () => {
      const reason = {
        type: "catch_all_reward",
        merchantName: "Amazon",
        title: "2x rewards on every purchase",
        explanation: "Earn 2x rewards on this Amazon purchase.",
        rewardRate: 0.02,
        estimatedValue: 0.65,
        applicableToPurchase: true,
        influencedRecommendation: true,
        sourceRuleId: "unknown-card:catch_all_reward",
      } satisfies RecommendationWinningReason;

      const decision = createPaymentDecision({
        wallet,
        merchant,
        recommendations: [recommendationFor(reason)],
        purchaseAmount: 32.51,
      });

      expect(decision.recommendationIntegrity?.valid).toBe(true);
      expect(decision.decisionNarrative?.headline).toBe(
        "This card earns the highest verified rewards among the eligible cards in your wallet.",
      );
      expect(decision.decisionNarrative?.estimatedReward).toBeNull();
      expect(decision.decisionNarrative?.rewardDetails).toEqual(
        expect.objectContaining({
          unit: "unknown",
          rate: 2,
          estimatedDisplay: null,
        }),
      );
      expect(JSON.stringify(decision.decisionNarrative)).not.toMatch(
        /2% eligible rewards|2x miles|2x points/i,
      );
    });

    test("rejects mismatched explanations and falls back to the actual winning rule", () => {
      const reason = {
        type: "catch_all_reward",
        merchantName: "Amazon",
        title: "2x miles on every purchase",
        explanation: "Earn 2x Venture Miles on this Amazon purchase.",
        rewardRate: 0.02,
        rewardUnit: "miles",
        estimatedValue: 0.63,
        applicableToPurchase: true,
        influencedRecommendation: true,
        sourceRuleId: "capital-one-venture:catch_all_reward",
      } satisfies RecommendationWinningReason;
      const recommendation = recommendationFor(reason);
      const validDecision = createPaymentDecision({
        wallet,
        merchant,
        recommendations: [recommendation],
        purchaseAmount: 31.49,
      });
      const corruptedNarrative = {
        ...validDecision.decisionNarrative!,
        headline: "$250 Capital One Travel credit applies here.",
        summary: "This checkout unlocks a travel credit.",
        primaryReason: {
          ...validDecision.decisionNarrative!.primaryReason,
          headline: "$250 Capital One Travel credit applies here.",
          ruleId: "capital-one-venture:travel_credit",
        },
      };

      const integrity = validateRecommendationIntegrity({
        narrative: corruptedNarrative,
        recommendation,
        alternatives: [],
        merchant,
        purchaseAmount: 31.49,
        winningReason: reason,
        relevantBenefits: [],
        confidence: { score: 0.91, label: "high" },
      });

      expect(integrity.validation).toEqual(
        expect.objectContaining({
          valid: false,
          fallbackApplied: true,
          reason: "primary reason rule id does not match winning rule",
          expectedRuleId: "capital-one-venture:catch_all_reward",
          expectedReasonType: "catch_all_reward",
        }),
      );
      expect(integrity.narrative.headline).toBe(
        "Earn 2x Venture Miles on this Amazon purchase.",
      );
      expect(JSON.stringify(integrity.narrative)).not.toMatch(
        /Travel credit/i,
      );
    });

    test("accepts missing purchase amount without fabricating unrelated benefits", () => {
      const reason = {
        type: "catch_all_reward",
        merchantName: "Amazon",
        title: "2x miles on every purchase",
        explanation: "Earn 2x Venture Miles on this Amazon purchase.",
        rewardRate: 0.02,
        rewardUnit: "miles",
        estimatedValue: undefined,
        applicableToPurchase: true,
        influencedRecommendation: true,
        sourceRuleId: "capital-one-venture:catch_all_reward",
      } satisfies RecommendationWinningReason;
      const decision = createPaymentDecision({
        wallet,
        merchant,
        recommendations: [recommendationFor(reason)],
        purchaseAmount: null,
      });

      expect(decision.recommendationIntegrity?.valid).toBe(true);
      expect(decision.decisionNarrative?.earningText).toBe("2x Venture Miles");
      expect(decision.decisionNarrative?.estimatedReward).toBe(
        "Estimated miles will update when Rewardly can read the final total.",
      );
      expect(decision.decisionNarrative?.estimatedRewardText).toBe(
        "Estimated miles will update when Rewardly can read the final total.",
      );
      expect(decision.decisionNarrative?.reward).toEqual(
        expect.objectContaining({
          type: "miles",
          programName: "Venture Miles",
          earningRate: 2,
          earningUnit: "miles_per_dollar",
          estimatedRewardQuantity: null,
          purchaseAmount: null,
        }),
      );
      expect(decision.decisionNarrative?.primaryReason).toEqual(
        expect.objectContaining({
          type: "catch_all_reward",
          ruleId: "capital-one-venture:catch_all_reward",
          benefitId: null,
          headline: "Earn 2x Venture Miles on this Amazon purchase.",
        }),
      );
      expect(JSON.stringify(decision.decisionNarrative)).not.toMatch(
        /Capital One Travel credit|airport/i,
      );
    });

    test("accepts unknown merchant without using generic card benefits", () => {
      const unknownMerchant = {
        name: "",
        category: "other",
        confidence: 0.25,
      };
      const reason = {
        type: "catch_all_reward",
        merchantName: "this purchase",
        title: "2x miles on every purchase",
        explanation: "Earn 2x Venture Miles on this purchase.",
        rewardRate: 0.02,
        rewardUnit: "miles",
        estimatedValue: 0.4,
        applicableToPurchase: true,
        influencedRecommendation: true,
        sourceRuleId: "capital-one-venture:catch_all_reward",
      } satisfies RecommendationWinningReason;
      const decision = createPaymentDecision({
        wallet,
        merchant: unknownMerchant,
        recommendations: [recommendationFor(reason)],
        purchaseAmount: 20,
      });

      expect(decision.recommendationIntegrity?.valid).toBe(true);
      expect(decision.decisionNarrative?.primaryReason).toEqual(
        expect.objectContaining({
          type: "catch_all_reward",
          ruleId: "capital-one-venture:catch_all_reward",
          benefitId: null,
        }),
      );
      expect(decision.decisionNarrative?.supportingReasons).toEqual([]);
      expect(JSON.stringify(decision.decisionNarrative)).not.toMatch(
        /Capital One Travel credit|airport/i,
      );
    });
  });
});
