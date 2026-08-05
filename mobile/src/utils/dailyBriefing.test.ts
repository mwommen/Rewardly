import { createDailyBriefing } from "./dailyBriefing";
import type { DailyBriefingInput } from "./dailyBriefing";
import type { WalletCoachSnapshot } from "../types/walletCoach";

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const baseInput: DailyBriefingInput = {
  wallet: [
    {
      cardId: "capital_one_venture",
      displayName: "Capital One Venture",
      issuer: "Capital One",
      annualFee: 95,
      rewardProgram: "Venture Miles",
    },
  ],
  walletCoach: null,
  paymentJourney: [],
  plans: [],
  nearbyMerchants: [],
  favoriteMerchants: [],
  locationGranted: false,
  generatedAt: "2026-08-04T12:00:00.000Z",
};

const coachSnapshot: WalletCoachSnapshot = {
  generatedAt: "2026-08-04T12:00:00.000Z",
  topOpportunity: {
    opportunityId: "opp-1",
    title: "One card could earn more.",
    explanation: "Use Smart Pay before dining purchases this month.",
    priority: "High",
    suggestedAction: "Use Smart Pay",
    whySurfaced: "Recent dining activity",
    supportingPaymentIds: [],
    estimatedAnnualValue: 17,
    category: "Dining",
    createdAt: "2026-08-04T12:00:00.000Z",
  },
  opportunities: [],
  biggestRecentWin: null,
  mostImprovedCategory: null,
  optimizationScore: {
    score: 80,
    trend: 0,
    optimizedPurchaseRate: 0.8,
    categoryCoverage: 0.5,
    recommendationAcceptanceRate: 0.9,
    walletDiversity: 0.6,
    missedOpportunityPenalty: 0,
    explanation: "Good coverage",
  },
  weeklySummary: {
    weekStart: "2026-08-03",
    weekEnd: "2026-08-09",
    purchasesCompleted: 2,
    optimizedPurchases: 2,
    estimatedRewards: 8.25,
    biggestOpportunity: null,
    strongestCategory: "Dining",
  },
  successMoments: [],
  suggestedAction: "Use Smart Pay",
};

const emptyWallet = createDailyBriefing({ ...baseInput, wallet: [] });
assertEqual(emptyWallet.cards[0].kind, "wallet_empty");
assertEqual(emptyWallet.cards[0].primaryAction, "add_card");

const planned = createDailyBriefing({
  ...baseInput,
  plans: [
    {
      planId: "plan-1",
      title: "Weekend shopping",
      status: "active",
      currency: "USD",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
      items: [
        {
          itemId: "item-1",
          merchant: { name: "Apple", category: "online_retail" },
          purchase: { amount: 1299, currency: "USD" },
          completionState: "planned",
          createdAt: "2026-08-04T12:00:00.000Z",
          updatedAt: "2026-08-04T12:00:00.000Z",
        },
      ],
    },
  ],
});
assertEqual(planned.cards[0].kind, "shopping_plan");
assertEqual(planned.cards[0].metadata?.planId, "plan-1");

const nearby = createDailyBriefing({
  ...baseInput,
  nearbyMerchants: [
    {
      name: "Target",
      category: "general_retail",
      distanceMiles: 0.2,
      accuracy: "mock",
      provider: "test",
    },
  ],
  locationGranted: true,
});
assertEqual(nearby.cards[0].kind, "nearby_smart_pay");
assertEqual(nearby.cards[0].primaryAction, "open_smart_pay_merchant");

const coaching = createDailyBriefing({ ...baseInput, walletCoach: coachSnapshot });
assertEqual(coaching.cards[0].kind, "wallet_coach");
assertEqual(coaching.cards[0].metadata?.valueLabel, "$17");

const journey = createDailyBriefing({
  ...baseInput,
  paymentJourney: [
    {
      paymentId: "payment-1",
      decisionId: "decision-1",
      merchant: "Amazon",
      purchaseAmount: 42,
      currency: "USD",
      recommendedCard: "Capital One Venture",
      selectedCard: "Capital One Venture",
      estimatedRewardValue: 0.84,
      confidence: 0.94,
      recommendationExplanation: { summary: "Earn 2x miles.", factors: [] },
      purchaseTimestamp: "2026-08-04T12:00:00.000Z",
      completionTimestamp: "2026-08-04T12:00:00.000Z",
      syncStatus: "local",
      schemaVersion: 1,
    },
  ],
});
assertEqual(journey.cards[0].kind, "recent_decision");
assertEqual(journey.cards[0].primaryAction, "open_payment");

console.log("Personal Intelligence briefing tests passed.");
