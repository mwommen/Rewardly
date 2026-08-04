export type FinancialIntentType =
  | "SMART_PAY"
  | "PLAN_PURCHASES"
  | "COMPLETE_PURCHASE"
  | "REVIEW_PAYMENT_HISTORY"
  | "VIEW_WALLET_COACH"
  | "VIEW_OPPORTUNITIES"
  | "VIEW_WEEKLY_SUMMARY";

export type FinancialIntentResponse<T = unknown> = {
  intentId: string;
  requestId: string;
  timestamp: string;
  intentType: FinancialIntentType;
  executedCapabilities: string[];
  result: T;
  warnings: string[];
  errors: Array<{ code: string; message: string }>;
  metadata: {
    executionTimeMs: number;
    success: boolean;
  };
};
