import type { Card } from "../../../packages/rewardly-core/src";
import type { CanonicalWalletBenefitState } from "../services/walletIntelligenceService";
import type { WalletDecisionResult } from "../services/walletDecisionEngine";

export type ScenarioPurchaseCategory =
  | "dining"
  | "grocery"
  | "gas"
  | "travel"
  | "airfare"
  | "hotel"
  | "drugstore"
  | "streaming"
  | "online_retail"
  | "general_retail"
  | "unknown";

export type ScenarioClassificationSource =
  | "verified_merchant_mapping"
  | "merchant_category_code"
  | "domain_mapping"
  | "inferred"
  | "unknown";

export type ScenarioRuleType =
  | "merchant_specific"
  | "portal"
  | "category"
  | "base"
  | "statement_credit";

export type ScenarioRejectedRuleReason =
  | "category_mismatch"
  | "merchant_mismatch"
  | "channel_mismatch"
  | "expired"
  | "not_yet_effective"
  | "enrollment_required"
  | "activation_required"
  | "cap_exhausted"
  | "credit_exhausted"
  | "wallet_state_missing"
  | "country_restriction"
  | "lower_value"
  | "not_owned"
  | "other";

export type RecommendationFailureCategory =
  | "wallet_integrity"
  | "wrong_winner"
  | "wrong_runner_up"
  | "wrong_benefit"
  | "wrong_rule_precedence"
  | "reward_calculation"
  | "valuation"
  | "classification"
  | "confidence"
  | "wallet_state"
  | "cap_handling"
  | "credit_handling"
  | "date_handling"
  | "enrollment_handling"
  | "activation_handling"
  | "explanation"
  | "registry_data"
  | "audit_trace"
  | "nondeterministic_result"
  | "scenario_definition";

export type ScenarioWallet = {
  userId: string;
  cards: Array<{
    cardSlug: string;
    cardId?: string;
    nickname?: string;
  }>;
};

export type ScenarioPurchase = {
  merchantName: string;
  normalizedMerchant?: string;
  merchantId?: string;
  amount: number;
  currency: "USD";
  channel: "online" | "in_store" | "issuer_portal";
  transactionDate: string;
  country?: string;
};

export type ScenarioClassification = {
  category: ScenarioPurchaseCategory;
  confidence: number;
  source: ScenarioClassificationSource;
  isVerified: boolean;
  evidence?: string[];
};

export type ScenarioWalletState = {
  cardStates?: Record<
    string,
    {
      enrolledBenefitIds?: string[];
      activatedBenefitIds?: string[];
      disabledBenefitIds?: string[];
      benefitUsage?: Record<
        string,
        {
          spendToDate?: number;
          rewardEarnedToDate?: number;
          creditUsed?: number;
          usesConsumed?: number;
          lastUpdatedAt?: string;
          confidence?: number;
        }
      >;
    }
  >;
};

export type ExpectedRecommendation = {
  winnerCardSlug: string;
  winnerBenefitId: string;
  winnerRuleType: ScenarioRuleType;
  runnerUpCardSlug?: string;
  runnerUpBenefitId?: string;
  expectedReward?: {
    quantity?: number;
    unit?: "points" | "miles" | "cash_back" | "statement_credit";
    cashEquivalent?: number;
    tolerance?: number;
  };
  confidence?: {
    level?: "high" | "medium" | "low";
    minScore?: number;
    maxScore?: number;
  };
  explanationMustContain?: string[];
  explanationMustNotContain?: string[];
  expectedRejectedRules?: Array<{
    cardSlug: string;
    benefitId: string;
    reason: ScenarioRejectedRuleReason;
  }>;
};

export type ScenarioMetadata = {
  issuer?: string;
  ruleType?: ScenarioRuleType;
  boundary?: string;
  generated?: boolean;
  generatorSeed?: number;
  generatorIndex?: number;
  issueId?: string;
  originalSeed?: number;
  dateDiscovered?: string;
  rootCauseCategory?: string;
  expectedBehavior?: string;
  fixedByCommit?: string;
  assumptions?: string[];
};

export type RecommendationScenario = {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  wallet: ScenarioWallet;
  purchase: ScenarioPurchase;
  classification: ScenarioClassification;
  walletState?: ScenarioWalletState;
  walletBenefitStates?: CanonicalWalletBenefitState[];
  expected: ExpectedRecommendation;
  metadata?: ScenarioMetadata;
};

export type ScenarioAssertionResult = {
  name: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  message?: string;
};

export type ScenarioValidationResult = {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  durationMs: number;
  expected: ExpectedRecommendation;
  actual: {
    winnerCardSlug?: string;
    winnerBenefitId?: string;
    runnerUpCardSlug?: string;
    runnerUpBenefitId?: string;
    rewardQuantity?: number | null;
    cashEquivalent?: number;
    confidenceScore?: number;
    confidenceLevel?: string;
    explanation?: string;
  };
  assertions: ScenarioAssertionResult[];
  failureCategories: RecommendationFailureCategory[];
  decisionTrace: WalletDecisionResult;
  reproductionCommand: string;
};

export type ScenarioCatalog = Record<string, Card>;

export type RecommendationValidationRun = {
  generatedAt: string;
  registryVersion: string;
  commitSha: string;
  seed?: number;
  suite?: string;
  generatedScenarioCount?: number;
  coverage?: {
    byRuleType: Record<string, number>;
    byPurchaseChannel: Record<string, number>;
    byClassificationSource: Record<string, number>;
    byConfidenceBand: Record<string, number>;
    byWalletSize: Record<string, number>;
    byCurrency: Record<string, number>;
    byRejectedReason: Record<string, number>;
    thresholdFailures: string[];
  };
  mutationSmoke?: Array<{
    mutationId: string;
    passedBaseline: boolean;
    mutationDetected: boolean;
    failureCategories: RecommendationFailureCategory[];
    killedBy?: string[];
    scenariosRun?: number;
    selectedScenarioIds?: string[];
    unexpectedErrors?: string[];
    durationMs?: number;
  }>;
  invariants?: {
    passed: number;
    total: number;
  };
  metamorphic?: {
    passed: number;
    total: number;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  byCategory: Record<string, { total: number; passed: number; failed: number }>;
  byFailureType: Record<string, number>;
  failures: ScenarioValidationResult[];
  results: ScenarioValidationResult[];
};
