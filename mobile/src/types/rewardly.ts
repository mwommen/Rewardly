export type CatalogCard = {
  cardId: string;
  displayName: string;
  issuer: string | null;
  annualFee: number | null;
  rewardProgram: string | null;
};

export type WalletCard = CatalogCard & {
  nickname?: string;
};

export type PaymentDecisionRequest = {
  merchant: {
    name: string;
    category?: string;
    domain?: string;
  };
  purchase: {
    amount: number;
    currency: "USD";
  };
  wallet: {
    cards: Array<{ cardId: string }>;
  };
};

export type PaymentDecisionResponse = {
  decisionId: string;
  status: "recommended" | "no_recommendation";
  recommendedPaymentMethod: {
    cardId: string;
    displayName: string;
  } | null;
  reason: string;
  estimatedValue: number | null;
  currency: "USD";
  confidence: number;
  explanation: {
    summary: string;
    factors: string[];
  };
  trust?: {
    trustRecordId: string;
    status: "complete" | "partial" | "unavailable";
    evidenceUrl: string;
    trustUrl: string;
    replayable: boolean;
  };
};

export type DecisionTrustRecord = {
  trustRecordId: string;
  decisionId: string;
  decisionType: "payment_decision";
  status: "complete" | "partial" | "unavailable";
  recommendation: {
    paymentMethodId: string | null;
    displayName: string | null;
    summary: string;
  };
  explanation: {
    headline: string;
    summary: string;
    primaryReason: {
      code: string;
      message: string;
    };
    supportingReasons: Array<{
      code: string;
      message: string;
    }>;
    tradeoffs: Array<{
      code: string;
      message: string;
      impact?: string;
    }>;
  };
  evidence: Array<{
    evidenceId: string;
    type: string;
    source: string;
    statement: string;
    effect: "supports" | "limits" | "excludes" | "informational";
    confidence?: number;
  }>;
  alternatives: Array<{
    paymentMethodId: string;
    displayName: string;
    rank: number;
    estimatedValue?: number | null;
    confidence?: number;
    reasonNotSelected: {
      code: string;
      message: string;
    };
    tradeoffs: string[];
  }>;
  warnings: Array<{
    code: string;
    severity: "info" | "caution" | "critical";
    message: string;
    userAction?: string;
  }>;
  assumptions: Array<{
    code: string;
    statement: string;
    source: "user" | "platform" | "inferred" | "default";
    confidence: number;
  }>;
  confidence: {
    overall: number;
    level: "high" | "medium" | "low";
    components: Record<string, number | "unavailable" | undefined>;
    explanation: string;
  };
  versions: Record<string, string | undefined>;
  reproducibility: {
    replayable: boolean;
    inputSnapshotId?: string;
    policySnapshotId?: string;
    missingDependencies: string[];
  };
  provenance: {
    commercialBiasApplied: false;
    dataSources: string[];
    decisionPolicy: string;
    evaluationTimestamp: string;
  };
  timestamps: {
    decisionCreatedAt: string;
    trustRecordCreatedAt: string;
  };
};

export type RecentPurchase = {
  id: string;
  merchant: string;
  amount: number;
  recommendedCard: string;
  estimatedValue: number | null;
  createdAt: string;
  decision: PaymentDecisionResponse;
};

export type MerchantSuggestion = {
  name: string;
  category?: string;
  domain?: string;
  knowledge?: MerchantKnowledgeProfile;
};

export type MerchantKnowledgeProfile = {
  merchantId: string;
  canonicalName: string;
  displayName: string;
  aliases: string[];
  category: string;
  categoryCode: string | null;
  subcategory: string | null;
  brand: string | null;
  parentCompany: string | null;
  merchantGroup: string | null;
  country: string;
  region: string | null;
  domains: string[];
  checkoutDomains: string[];
  billingDescriptors: string[];
  mccs: string[];
  supportedPaymentMethods: string[];
  loyaltyPrograms: string[];
  tags: string[];
  metadata: Record<string, string | number | boolean | null>;
  active: boolean;
  confidence: number;
  lastUpdated: string;
};

export type MerchantSearchResult = MerchantKnowledgeProfile & {
  score: number;
  matchType: string;
  matchedValue: string | null;
};

export type MerchantInsight = {
  merchantId: string;
  displayName: string;
  paymentJourneyEntries: number;
  mostUsedCard: string | null;
  estimatedRewardsEarned: number;
  averagePurchaseAmount: number | null;
  plannedSpendingEntries: number;
  lastUpdated: string;
};
