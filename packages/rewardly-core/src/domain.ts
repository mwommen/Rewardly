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
  timestamp?: string;
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
};
