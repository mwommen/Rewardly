export type ClientSurface = "website" | "extension" | "mobile" | "backend";

export type MerchantCategory =
  | "apparel"
  | "departmentstores"
  | "dining"
  | "drugstores"
  | "entertainment"
  | "gas"
  | "groceries"
  | "online_shopping"
  | "rideshare"
  | "streaming"
  | "travel"
  | "other";

export type RewardUnit = "cash" | "points" | "miles";

export type Reward = {
  category: MerchantCategory | string;
  rate: number;
  unit: RewardUnit;
  label?: string;
};

export type Benefit = {
  id?: string;
  label: string;
  type?:
    "credit" | "protection" | "insurance" | "travel_perk" | "offer" | "other";
  amountUSD?: number | null;
  period?: "month" | "quarter" | "semi-annual" | "year" | string | null;
  requiresEnrollment?: boolean;
  sourceUrl?: string | null;
  enrollmentUrl?: string | null;
};

export type Card = {
  slug: string;
  name: string;
  issuer?: string | null;
  annualFee?: number | null;
  rewards?: Reward[];
  perks?: string[];
  benefits?: Benefit[];
  sourceUrl?: string | null;
  lastVerified?: string | null;
};

export type Wallet = {
  userId: string;
  cards: Card[];
  source: "manual" | "plaid" | "mixed" | "empty";
  cardSlugs: string[];
};

export type Merchant = {
  name: string;
  domain?: string | null;
  hostname?: string | null;
  category?: MerchantCategory | string | null;
  mcc?: string | null;
  confidence?: number;
};

export type CheckoutStage =
  "cart" | "checkout" | "payment" | "review" | "confirmation" | "unknown";

export type PurchaseContext = {
  surface: ClientSurface;
  url?: string | null;
  checkoutDetected?: boolean;
  checkoutStage?: CheckoutStage;
  amount?: number | null;
  currency?: string;
  purchase?: Purchase | null;
  timestamp?: string;
};

export type PurchaseConfidenceLabel = "high" | "medium" | "low" | "unknown";

export type PurchaseCategory =
  | "apparel"
  | "digital_goods"
  | "electronics"
  | "fuel"
  | "gift_card"
  | "groceries"
  | "home_improvement"
  | "pharmacy"
  | "restaurant"
  | "subscription"
  | "technology_purchase"
  | "travel"
  | "unknown";

export type PurchaseItem = {
  itemId: string;
  name: string;
  quantity: number;
  price: number | null;
  category: string | null;
  merchantCategory: string | null;
  normalizedCategory: PurchaseCategory;
  recommendationCategory: string;
  brand: string | null;
  digitalOrPhysical: "digital" | "physical" | "mixed" | "unknown";
  exclusions: string[];
  confidence: number;
};

export type Purchase = {
  purchaseId: string;
  merchantId: string | null;
  subtotal: number | null;
  tax: number | null;
  shipping: number | null;
  discounts: number | null;
  total: number | null;
  currency: string;
  checkoutProvider: string | null;
  confidence: {
    score: number;
    label: PurchaseConfidenceLabel;
  };
  items: PurchaseItem[];
  categoryDistribution: Array<{
    normalizedCategory: PurchaseCategory;
    itemCount: number;
    estimatedAmount: number | null;
    share: number;
  }>;
  exclusions: string[];
  extractedAt: string;
};

export type RecommendationPurchaseContext = {
  dominantCategory: PurchaseCategory | null;
  categoryDistribution: Array<{
    normalizedCategory: PurchaseCategory;
    estimatedAmount: number | null;
    share: number;
  }>;
  exclusions: string[];
  confidenceScore: number;
  confidenceLabel: PurchaseConfidenceLabel;
  hasGiftCard: boolean;
  hasCashEquivalent: boolean;
  hasDigitalGoods: boolean;
  hasSubscription: boolean;
  total: number | null;
  eligibleAmount: number | null;
  materiallyMixed: boolean;
  mixedCartThreshold: number;
  refinement:
    | "purchase_refined"
    | "merchant_based"
    | "low_confidence_fallback"
    | "mixed_cart_fallback";
};

export type PaymentContext = {
  userId: string;
  wallet: Wallet;
  merchant: Merchant;
  purchase: PurchaseContext;
};

export type BenefitMatch = {
  benefit: Benefit;
  card: Pick<Card, "slug" | "name" | "issuer">;
  summary: string;
  requirement?: string;
  limitation?: string;
};

export type DecisionReason = {
  label: string;
  detail: string;
  kind: "reward" | "benefit" | "protection" | "fallback";
};

export type RecommendationWinningReason = {
  type:
    | "merchant_reward"
    | "merchant_offer"
    | "merchant_credit"
    | "category_reward"
    | "rotating_category"
    | "portal_reward"
    | "catch_all_reward"
    | "threshold_offer"
    | "other";
  merchantId?: string;
  merchantName?: string;
  title: string;
  explanation: string;
  rewardRate?: number;
  rewardUnit?: "percent" | "points" | "miles" | "cash";
  estimatedValue?: number;
  estimatedIncrementalValue?: number;
  applicableToPurchase: boolean;
  influencedRecommendation: boolean;
  sourceBenefitId?: string;
  sourceRuleId?: string;
};

export type DecisionNarrativeReasonType =
  | "merchant_offer"
  | "merchant_reward"
  | "category_bonus"
  | "rotating_category"
  | "statement_credit"
  | "portal_reward"
  | "catch_all_reward"
  | "threshold_offer"
  | "fallback";

export type DecisionRewardDetails = {
  rate?: number | null;
  unit?:
    | "miles_per_dollar"
    | "points_per_dollar"
    | "cash_back_percent"
    | "statement_credit"
    | "unknown";
  programName?: string | null;
  estimatedQuantity?: number | null;
  displayQuantity?: string | null;
  purchaseAmount?: number | null;
  estimatedCashBack?: number | null;
  displayCashBack?: string | null;
  creditAmount?: number | null;
  applicableCreditAmount?: number | null;
  estimatedDisplay?: string | null;
};

export type DecisionNormalizedReward = {
  type:
    | "cash_back"
    | "points"
    | "miles"
    | "statement_credit"
    | "certificate"
    | "free_night"
    | "travel_credit"
    | "unknown";
  programName?: string | null;
  earningRate?: number | null;
  earningUnit?:
    | "points_per_dollar"
    | "miles_per_dollar"
    | "percent_back"
    | "flat_credit"
    | "unknown";
  estimatedRewardQuantity?: number | null;
  estimatedRewardCashValue?: number | null;
  purchaseAmount?: number | null;
};

export type DecisionNarrative = {
  merchant: string;
  purchaseAmount?: number | null;
  recommendedCard: {
    slug: string;
    name: string;
    issuer?: string | null;
  };
  reasonType: DecisionNarrativeReasonType;
  headline: string;
  summary: string;
  estimatedReward?: string | null;
  estimatedRewardUnit?:
    "dollars" | "points" | "miles" | "cash" | "unknown" | null;
  estimatedRewardValue?: number | null;
  rewardDetails?: DecisionRewardDetails | null;
  reward?: DecisionNormalizedReward | null;
  earningText?: string | null;
  estimatedRewardText?: string | null;
  comparisonText?: string | null;
  reasonText?: string | null;
  incrementalValue?: number | null;
  comparison?: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  primaryReason: {
    type: DecisionNarrativeReasonType;
    headline: string;
    summary: string;
    ruleId?: string | null;
    benefitId?: string | null;
    scoreContribution?: number | null;
  };
  supportingReasons: Array<{
    type: DecisionNarrativeReasonType;
    headline: string;
    summary: string;
    ruleId?: string | null;
    benefitId?: string | null;
    scoreContribution?: number | null;
  }>;
  scoringEvidence: Array<{
    label: string;
    value: string | number | boolean | null;
    source?: string | null;
  }>;
};

export type RecommendationIntegrityValidation = {
  valid: boolean;
  fallbackApplied: boolean;
  reason: string | null;
  expectedRuleId?: string | null;
  expectedBenefitId?: string | null;
  expectedReasonType?: DecisionNarrativeReasonType | null;
};

export type Recommendation = {
  card: Card;
  primaryReason: DecisionReason;
  rewardEstimate?: {
    label: string;
    effectiveRate?: number;
    estimatedValueUSD?: number;
  };
  confidence?: {
    score: number;
    label: "high" | "medium" | "low";
    factors?: Record<string, number>;
    reasons?: string[];
  };
  unlockedBenefits: BenefitMatch[];
  winningReason?: RecommendationWinningReason | null;
  relevantBenefits?: BenefitMatch[];
};

export type PaymentDecision = {
  recommendedCard: Recommendation | null;
  alternativeCards: Recommendation[];
  primaryReason: DecisionReason | null;
  rewardEstimate?: Recommendation["rewardEstimate"];
  unlockedBenefits: BenefitMatch[];
  winningReason?: RecommendationWinningReason | null;
  relevantBenefits?: BenefitMatch[];
  confidence: {
    score?: number;
    label: "high" | "medium" | "low" | "unknown";
  };
  recommendationSummary: string;
  contextualInsight?: string;
  merchant: Merchant;
  wallet: Pick<Wallet, "userId" | "source" | "cardSlugs">;
  generatedAt: string;
  purchase?: Purchase | null;
  recommendationPurchaseContext?: RecommendationPurchaseContext | null;
  decisionExplanation?: unknown;
  merchantIntelligence?: unknown;
  decisionContext?: unknown;
  decisionNarrative?: DecisionNarrative | null;
  recommendationIntegrity?: RecommendationIntegrityValidation | null;
};
