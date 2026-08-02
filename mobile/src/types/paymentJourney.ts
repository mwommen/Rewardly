import type { PaymentDecisionResponse } from "./rewardly";

export type PaymentJourneyEntry = {
  paymentId: string;
  decisionId: string;
  merchant: string;
  purchaseAmount: number;
  currency: "USD";
  recommendedCard: string;
  selectedCard: string;
  estimatedRewardValue: number | null;
  confidence: number;
  recommendationExplanation: PaymentDecisionResponse["explanation"];
  purchaseTimestamp: string;
  completionTimestamp: string;
  userNotes?: string;
  syncStatus: "local";
  schemaVersion: 1;
};

export type PaymentJourneyFilter = "week" | "month" | "all";

export type MonthlyProgress = {
  smartPayments: number;
  estimatedRewards: number;
  averageConfidence: number | null;
  bestMerchant: string | null;
  mostUsedCard: string | null;
};
