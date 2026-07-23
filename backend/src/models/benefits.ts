export type Period = "month" | "quarter" | "semi-annual" | "year";
export type RewardUnit = "cash" | "points" | "miles";
export type BenefitSourceType =
  | "issuer_official"
  | "issuer_terms"
  | "network_official"
  | "manually_entered"
  | "third_party_reference"
  | "missing";

export type RewardsArrayEntry = {
  keys: string[];
  rate: string; // "3%", "4x"
  unit: RewardUnit;
  capPerPeriodUSD?: number;
  period?: Period;
  eligibleWhen?: { merchantPatterns?: string[]; mcc?: string[]; channels?: string[] };
  sourceUrl?: string;
  sourceType?: BenefitSourceType;
  confidence?: number;
};

export type RewardsEntry = RewardsArrayEntry | Record<string, string>;

export type RotatingWindow = {
  start?: string; end?: string; activationRequired?: boolean;
  categories: RewardsArrayEntry[];
};

export type MerchantCredit = {
  id: string; label: string;
  amountUSD: number; period: Period; capPerPeriodUSD: number;
  eligibleWhen?: { merchantPatterns?: string[]; mcc?: string[] };
  requiresEnrollment?: boolean;
  expiresAt?: string | null;
  sourceUrl?: string; sourceType?: BenefitSourceType; enrollmentUrl?: string; confidence?: number;
};

export type RecurringCredit = {
  id: string; label: string; amountUSD: number; period: Period;
  partner?: string; requiresEnrollment?: boolean;
  sourceUrl?: string; sourceType?: BenefitSourceType; enrollmentUrl?: string; confidence?: number;
};

export type BenefitsPayload = {
  rewardsByCategory?: RewardsEntry | RewardsEntry[];
  rewardsFlat?: { rate: number; unit: RewardUnit }[];
  rewardsRotating?: RotatingWindow[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  perks?: string[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string; sourceType?: BenefitSourceType }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string; sourceType?: BenefitSourceType }[];
  signupOffer?: string | null;
  sourceUrl?: string; sourceType?: BenefitSourceType; sourceTitle?: string;
  lastScraped?: string; lastVerified?: string; confidence?: number;
  productionEligible?: boolean;
};
