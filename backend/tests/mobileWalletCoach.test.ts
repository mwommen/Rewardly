import {
  addDismissedOpportunity,
  calculateOptimizationScore,
  calculateWeeklySummary,
  coachNavigationTarget,
  createWalletCoachSnapshot,
  safeDismissedOpportunities,
} from "../../mobile/src/utils/walletCoach";
import { createPaymentJourneyEntry } from "../../mobile/src/utils/paymentJourney";
import type { PaymentDecisionResponse, WalletCard } from "../../mobile/src/types/rewardly";

const now = new Date("2026-08-20T12:00:00.000Z");

const wallet: WalletCard[] = [
  {
    cardId: "amex-gold",
    displayName: "American Express Gold",
    issuer: "American Express",
    annualFee: 325,
    rewardProgram: "Membership Rewards",
  },
  {
    cardId: "venture",
    displayName: "Capital One Venture Rewards",
    issuer: "Capital One",
    annualFee: 95,
    rewardProgram: "Venture Miles",
  },
];

function decision(
  id: string,
  cardName = "American Express Gold",
  overrides: Partial<PaymentDecisionResponse> = {},
): PaymentDecisionResponse {
  return {
    decisionId: id,
    status: "recommended",
    recommendedPaymentMethod: {
      cardId: cardName.toLowerCase().replace(/\s+/g, "-"),
      displayName: cardName,
    },
    reason: "Highest verified value.",
    estimatedValue: 4,
    currency: "USD",
    confidence: 0.95,
    explanation: {
      summary: "Earns the highest verified rewards for this dining purchase.",
      factors: ["Dining category", "Highest estimated value"],
    },
    ...overrides,
  };
}

function entry({
  id,
  merchant,
  cardName,
  selectedCard,
  estimatedValue = 4,
  confidence = 0.95,
  timestamp,
}: {
  id: string;
  merchant: string;
  cardName?: string;
  selectedCard?: string;
  estimatedValue?: number | null;
  confidence?: number;
  timestamp: string;
}) {
  return createPaymentJourneyEntry({
    decision: decision(id, cardName, { estimatedValue, confidence }),
    merchant,
    amount: 100,
    selectedCard,
    now: new Date(timestamp),
  });
}

describe("mobile wallet coach domain", () => {
  test("generates onboarding opportunities for empty payment journey", () => {
    const snapshot = createWalletCoachSnapshot({ wallet, journey: [], now });

    expect(snapshot.topOpportunity?.opportunityId).toBe("complete-first-smart-pay");
    expect(snapshot.optimizationScore.score).toBeGreaterThan(0);
    expect(snapshot.weeklySummary.purchasesCompleted).toBe(0);
  });

  test("surfaces card setup before journey coaching when wallet is empty", () => {
    const snapshot = createWalletCoachSnapshot({ wallet: [], journey: [], now });

    expect(snapshot.opportunities.map((item) => item.opportunityId)).toContain(
      "add-wallet-cards",
    );
  });

  test("calculates optimization score from accepted recommendations and wallet diversity", () => {
    const journey = [
      entry({
        id: "starbucks-1",
        merchant: "Starbucks",
        timestamp: "2026-08-15T12:00:00.000Z",
      }),
      entry({
        id: "target-1",
        merchant: "Target",
        selectedCard: "Capital One Venture Rewards",
        timestamp: "2026-08-16T12:00:00.000Z",
      }),
    ];

    const score = calculateOptimizationScore(wallet, journey, now);

    expect(score.score).toBeLessThan(90);
    expect(score.optimizedPurchaseRate).toBe(0.5);
    expect(score.recommendationAcceptanceRate).toBe(0.5);
  });

  test("creates weekly summary from recent journey entries", () => {
    const journey = [
      entry({
        id: "recent",
        merchant: "Starbucks",
        estimatedValue: 5,
        timestamp: "2026-08-19T12:00:00.000Z",
      }),
      entry({
        id: "old",
        merchant: "Delta",
        estimatedValue: 20,
        timestamp: "2026-07-01T12:00:00.000Z",
      }),
    ];

    const weekly = calculateWeeklySummary(journey, [], now);

    expect(weekly.purchasesCompleted).toBe(1);
    expect(weekly.optimizedPurchases).toBe(1);
    expect(weekly.estimatedRewards).toBe(5);
    expect(weekly.strongestCategory).toBe("restaurants");
  });

  test("prevents duplicate dismissed opportunities and recovers storage safely", () => {
    const first = addDismissedOpportunity([], "frequent-target-shopper", now);
    const second = addDismissedOpportunity(first, "frequent-target-shopper", now);

    expect(second).toHaveLength(1);
    expect(safeDismissedOpportunities([{ broken: true }, ...second])).toEqual(second);
  });

  test("filters dismissed opportunities from coaching snapshot", () => {
    const journey = [
      entry({
        id: "target-1",
        merchant: "Target",
        timestamp: "2026-08-17T12:00:00.000Z",
      }),
      entry({
        id: "target-2",
        merchant: "Target",
        timestamp: "2026-08-18T12:00:00.000Z",
      }),
    ];

    const snapshot = createWalletCoachSnapshot({
      wallet,
      journey,
      dismissedOpportunityIds: ["frequent-target-shopper"],
      now,
    });

    expect(snapshot.opportunities.map((item) => item.opportunityId)).not.toContain(
      "frequent-target-shopper",
    );
  });

  test("changes opportunity output when wallet composition changes", () => {
    const travelWallet = [
      ...wallet,
      {
        cardId: "sapphire-preferred",
        displayName: "Chase Sapphire Preferred",
        issuer: "Chase",
        annualFee: 95,
        rewardProgram: "Ultimate Rewards",
      },
    ];
    const journey = [
      entry({
        id: "starbucks-1",
        merchant: "Starbucks",
        timestamp: "2026-08-18T12:00:00.000Z",
      }),
    ];

    const snapshot = createWalletCoachSnapshot({ wallet: travelWallet, journey, now });

    expect(snapshot.opportunities.map((item) => item.opportunityId)).toContain(
      "travel-card-unused",
    );
  });

  test("exposes deterministic navigation target for opportunity details", () => {
    expect(coachNavigationTarget("frequent-target-shopper")).toEqual({
      screen: "OpportunityDetail",
      params: { opportunityId: "frequent-target-shopper" },
    });
  });
});
