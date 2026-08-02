import type { PaymentDecisionResponse } from "./rewardly";

export type PlannedMerchant = {
  name: string;
  category?: string;
  domain?: string;
};

export type PlannedPurchase = {
  amount: number;
  currency: "USD";
};

export type ShoppingPlanItem = {
  itemId: string;
  merchant: PlannedMerchant;
  purchase: PlannedPurchase;
  notes?: string;
  completionState: "planned" | "completed";
  completedAt?: string;
  completedDecisionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingPlan = {
  planId: string;
  title: string;
  notes?: string;
  status: "active" | "completed";
  currency: "USD";
  items: ShoppingPlanItem[];
  createdAt: string;
  updatedAt: string;
};

export type PlanOptimization = {
  planId: string;
  title: string;
  estimatedTotalRewards: number | null;
  currency: "USD";
  optimizedItems: Array<{
    itemId: string;
    merchant: PlannedMerchant;
    purchase: PlannedPurchase;
    completionState: ShoppingPlanItem["completionState"];
    decision: PaymentDecisionResponse;
  }>;
  opportunitySummary: string;
  progress: {
    plannedPurchases: number;
    completedPurchases: number;
    remainingPurchases: number;
    estimatedRewardsEarned: number;
    estimatedRewardsRemaining: number;
  };
};

export type CreatePlanInput = {
  title: string;
  notes?: string;
};

export type AddPlanItemInput = {
  merchant: PlannedMerchant;
  purchase: PlannedPurchase;
  notes?: string;
};
