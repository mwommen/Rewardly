import type { PaymentJourneyEntry } from "./paymentJourney";

export type OpportunityPriority = "High" | "Medium" | "Low";

export type WalletCoachOpportunity = {
  opportunityId: string;
  title: string;
  explanation: string;
  priority: OpportunityPriority;
  suggestedAction: string;
  whySurfaced: string;
  supportingPaymentIds: string[];
  estimatedAnnualValue: number | null;
  category: string | null;
  createdAt: string;
};

export type DismissedOpportunity = {
  opportunityId: string;
  dismissedAt: string;
};

export type OptimizationScore = {
  score: number;
  trend: number;
  optimizedPurchaseRate: number;
  categoryCoverage: number;
  recommendationAcceptanceRate: number;
  walletDiversity: number;
  missedOpportunityPenalty: number;
  explanation: string;
};

export type WeeklySummary = {
  weekStart: string;
  weekEnd: string;
  purchasesCompleted: number;
  optimizedPurchases: number;
  estimatedRewards: number;
  biggestOpportunity: string | null;
  strongestCategory: string | null;
};

export type SuccessMoment = {
  momentId: string;
  title: string;
  explanation: string;
};

export type WalletCoachSnapshot = {
  generatedAt: string;
  topOpportunity: WalletCoachOpportunity | null;
  opportunities: WalletCoachOpportunity[];
  biggestRecentWin: PaymentJourneyEntry | null;
  mostImprovedCategory: string | null;
  optimizationScore: OptimizationScore;
  weeklySummary: WeeklySummary;
  successMoments: SuccessMoment[];
  suggestedAction: string;
};
