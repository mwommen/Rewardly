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
  refinement: "purchase_refined" | "merchant_based" | "low_confidence_fallback" | "mixed_cart_fallback";
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
};

export type PaymentDecision = {
  recommendedCard: Recommendation | null;
  alternativeCards: Recommendation[];
  primaryReason: DecisionReason | null;
  rewardEstimate?: Recommendation["rewardEstimate"];
  unlockedBenefits: BenefitMatch[];
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
};
