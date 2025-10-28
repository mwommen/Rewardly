export type Period = "month" | "quarter" | "semi-annual" | "year";

export type RewardsEntry =
  | { keys: string[]; rate: string; unit: "cash" | "points" | "miles" }
  | Record<string, string>;

export type RotatingWindow = {
  start?: string; end?: string; activationRequired?: boolean;
  categories: { keys: string[]; rate: string; unit: "cash" | "points" | "miles" }[];
};

export type MerchantCredit = {
  id: string; label: string;
  amountUSD: number; period: Period; capPerPeriodUSD: number;
  eligibleWhen?: { merchantPatterns?: string[]; mcc?: string[] };
  requiresEnrollment?: boolean;
  expiresAt?: string | null;
  sourceUrl?: string; confidence?: number;
};

export type RecurringCredit = {
  id: string; label: string; amountUSD: number; period: Period;
  partner?: string; requiresEnrollment?: boolean;
  sourceUrl?: string; confidence?: number;
};

export type BenefitsPayload = {
  rewardsByCategory?: RewardsEntry | RewardsEntry[];
  rewardsFlat?: { rate: number; unit: "cash" | "points" | "miles" }[];
  rewardsRotating?: RotatingWindow[];
  merchantCredits?: MerchantCredit[];
  recurringCredits?: RecurringCredit[];
  perks?: string[];
  access?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  insurances?: { id: string; label: string; details?: string; sourceUrl?: string }[];
  signupOffer?: string | null;
  sourceUrl?: string; lastScraped?: string; confidence?: number;
};
