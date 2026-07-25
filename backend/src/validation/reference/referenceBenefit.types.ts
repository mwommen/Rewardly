import type { ScenarioRuleType } from "../recommendationScenario.types";

export type ReferenceRewardCurrency = "cash" | "points" | "miles" | "statement_credit";

export type ReferenceBenefit = {
  id: string;
  cardSlug: string;
  cardName: string;
  issuer: string;
  ruleType: ScenarioRuleType;
  rewardCurrency: ReferenceRewardCurrency;
  rate: number;
  rateUnit: "x" | "percent" | "credit";
  categories: string[];
  merchants: string[];
  channels: Array<"online" | "in_store" | "issuer_portal" | "any">;
  enrollmentRequired: boolean;
  activationRequired: boolean;
  capAmountUSD: number | null;
  creditAmountUSD: number | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  confidence: number;
  source: string;
  lastVerified: string | null;
  precedence: number;
};

export type ReferenceCard = {
  slug: string;
  name: string;
  issuer: string;
  benefits: ReferenceBenefit[];
};

export type ReferenceCandidate = {
  cardSlug: string;
  cardName: string;
  benefitId: string;
  ruleType: ScenarioRuleType;
  estimatedValueUSD: number;
  rewardQuantity: number;
  confidence: number;
  precedence: number;
  rejectionReasons: string[];
};

export type ReferenceEvaluation = {
  winnerCardSlug: string;
  winnerBenefitId: string;
  winnerRuleType: ScenarioRuleType;
  runnerUpCardSlug?: string;
  runnerUpBenefitId?: string;
  expectedValueUSD: number;
  reason: string;
  candidates: ReferenceCandidate[];
};
