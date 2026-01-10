// frontend/src/cardModules.ts

export interface CardBenefits {
  [key: string]: number; // category or merchant -> points multiplier
}

export type Period = "month" | "quarter" | "semi-annual" | "year";

export type MerchantCredit = {
  id: string;
  label: string;
  amountUSD: number;
  period: Period;
  capPerPeriodUSD: number;
  requiresEnrollment?: boolean;
  expiresAt?: string | null;
};

export type RecurringCredit = {
  id: string;
  label: string;
  amountUSD: number;
  period: Period;
  partner?: string;
  requiresEnrollment?: boolean;
};

export interface Card {
  _id?: string; // backend ID
  name: string;
  issuer: string;
  type?: "Cashback" | "Travel" | "Rewards";
  annualFee: number;
  apr: string;
  benefits: CardBenefits;
  rewardsByCategory?: Record<string, number>;
  perks: string[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  lastUpdated: string;
}
