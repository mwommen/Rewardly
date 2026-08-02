// Rewardly V2 draft API contracts.
// Prototype only. Do not import into production code during the blueprint sprint.

export type Environment = "test" | "live";
export type Currency = "USD";
export type Channel = "online" | "in_store" | "mobile_app" | "subscription" | "unknown";

export type PaymentDecisionRequest = {
  externalUserId?: string;
  wallet: WalletInput;
  purchase: PurchaseContext;
  preferences?: {
    valuationProfile?: "rewardly_default" | string;
  };
  metadata?: Record<string, string | number | boolean | null>;
};

export type WalletInput = {
  paymentMethods: PaymentMethodInput[];
  benefitStates?: BenefitStateInput[];
};

export type PaymentMethodInput = {
  type: "credit_card";
  cardSlug: string;
  referenceId?: string;
};

export type BenefitStateInput = {
  cardSlug: string;
  benefitId: string;
  status: "unknown" | "available" | "enrollment_required" | "activation_required" | "active" | "partially_used" | "exhausted" | "expired";
  remainingValueMinor?: number;
  currency?: Currency;
  confidence?: number;
};

export type PurchaseContext = {
  amountMinor?: number;
  currency?: Currency;
  channel: Channel;
  merchant: MerchantContext;
  occurredAt?: string;
};

export type MerchantContext = {
  rewardlyMerchantId?: string;
  name?: string;
  domain?: string;
  merchantCategoryCode?: string;
  partnerCategory?: string;
  country?: "US" | string;
};

export type PaymentDecisionResponse = {
  id: string;
  status: "recommended" | "no_recommendation" | "insufficient_context" | "unsupported_wallet" | "unsupported_merchant" | "low_confidence";
  recommendation?: Recommendation;
  alternatives: Alternative[];
  estimatedValue?: EstimatedValue;
  explanation: Explanation;
  confidence: Confidence;
  warnings: DecisionWarning[];
  audit: DecisionAuditReference;
  engine: {
    version: string;
    evaluatedAt: string;
    dataVersions: Record<string, string | number>;
  };
  requestId: string;
};

export type Recommendation = {
  paymentMethodReferenceId?: string;
  cardSlug: string;
  displayName: string;
  appliedRuleIds: string[];
};

export type Alternative = {
  cardSlug: string;
  displayName: string;
  estimatedValueMinor?: number;
  reason?: string;
};

export type EstimatedValue = {
  rewardValueMinor?: number;
  incrementalValueMinor?: number | null;
  nextBestValueMinor?: number | null;
  currency: Currency;
  valuationProfile: string;
  guaranteed: false;
};

export type Explanation = {
  summary: string;
  reasons: string[];
  trace?: Array<{
    ruleId: string;
    version: number;
    outcome: "applied" | "rejected";
    reason: string;
  }>;
};

export type Confidence = {
  score: number;
  level: "high" | "medium" | "low" | "unavailable";
  factors?: Record<string, number>;
};

export type DecisionWarning = {
  code: string;
  message: string;
  path?: string;
};

export type DecisionAuditReference = {
  decisionId: string;
  replayable: boolean;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    docsUrl?: string;
    details?: Array<{
      path: string;
      value?: string;
      message: string;
    }>;
  };
};
