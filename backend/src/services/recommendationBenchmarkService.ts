import {
  createDecisionReplaySnapshot,
  explainRecommendationDecision,
  replayDecisionSnapshot,
  type DecisionExplanation,
} from "./decisionIntelligenceService";
import { recommendBestCards, type RecommendationScoringMode } from "./recommendationService";
import {
  canonicalizeWalletBenefitState,
  type CanonicalWalletBenefitState,
} from "./walletIntelligenceService";

export type BenchmarkCategory =
  | "restaurants"
  | "groceries"
  | "travel"
  | "flights"
  | "hotels"
  | "gas"
  | "streaming"
  | "amazon"
  | "retail"
  | "drugstores"
  | "rotating_categories"
  | "multiple_benefit_conflicts"
  | "spend_cap_scenarios"
  | "expired_benefits"
  | "unknown_merchant"
  | "low_confidence"
  | "wallet_state_missing"
  | "merchant_alias"
  | "parent_merchant"
  | "billing_descriptor";

export type RecommendationBenchmarkScenario = {
  scenarioId: string;
  category: BenchmarkCategory;
  merchant: string;
  merchantCategory: string;
  purchaseAmount: number;
  purchaseContext: {
    channel: "online" | "in_store" | "mobile_app" | "subscription";
    mcc?: string | null;
  };
  userWallet: {
    userId: string;
    cardSlugs: string[];
  };
  walletState: CanonicalWalletBenefitState[];
  benefitSnapshot: any[];
  expected: {
    winningCard: string | null;
    benefitId?: string | null;
    rewardValueUSD?: number | null;
    confidenceRange?: { min: number; max: number };
    explanationMustInclude?: string[];
  };
  notes: string[];
};

export type BenchmarkScenarioResult = {
  scenarioId: string;
  category: BenchmarkCategory;
  expectedWinningCard: string | null;
  actualWinningCard: string | null;
  expectedBenefit: string | null;
  actualBenefit: string | null;
  expectedRewardValueUSD: number | null;
  actualRewardValueUSD: number | null;
  rewardDifference: number | null;
  confidenceDifference: number | null;
  explanationQuality: number;
  executionTimeMs: number;
  replayMatched: boolean;
  passed: boolean;
  failures: string[];
  explanation: DecisionExplanation;
};

export type BenchmarkRunReport = {
  benchmarkVersion: string;
  generatedAt: string;
  scenarioCount: number;
  passCount: number;
  failCount: number;
  metrics: RecommendationAccuracyMetrics;
  calibration: ConfidenceCalibrationReport;
  leaderboard: RecommendationLeaderboard;
  results: BenchmarkScenarioResult[];
};

export type RecommendationAccuracyMetrics = {
  recommendationAccuracy: number;
  confidenceCalibration: number;
  merchantResolutionAccuracy: number;
  walletResolutionAccuracy: number;
  benefitSelectionAccuracy: number;
  replayConsistency: number;
  explanationCompleteness: number;
  benchmarkPassRate: number;
};

export type ConfidenceCalibrationReport = {
  overconfident: number;
  underconfident: number;
  calibrationDrift: number;
  distribution: Record<"high" | "medium" | "low", number>;
};

export type RecommendationLeaderboard = {
  mostAccurateCategories: Array<{ category: BenchmarkCategory; passRate: number }>;
  lowestConfidenceCategories: Array<{ category: BenchmarkCategory; averageConfidence: number }>;
  commonFailures: Array<{ failure: string; count: number }>;
  frequentlySelectedCards: Array<{ cardSlug: string; count: number }>;
  frequentlySelectedBenefits: Array<{ benefitId: string; count: number }>;
  highestValueRecommendations: Array<{ scenarioId: string; cardSlug: string | null; valueUSD: number }>;
};

export type EngineComparisonReport = {
  baselineVersion: string;
  candidateVersion: string;
  scenarioCount: number;
  winnerChanged: number;
  regressions: BenchmarkRegression[];
  improvements: Array<{ scenarioId: string; reason: string }>;
  averageConfidenceDelta: number;
  averageRewardDelta: number;
};

export type BenchmarkRegression = {
  scenarioId: string;
  type:
    | "recommendation_regression"
    | "confidence_regression"
    | "merchant_regression"
    | "wallet_regression"
    | "benefit_regression"
    | "replay_failure";
  severity: "low" | "medium" | "high";
  message: string;
};

export const BENCHMARK_VERSION = "rewardly-benchmark-v1";

export async function runRecommendationBenchmarks(
  scenarios = recommendationBenchmarkScenarios(),
  options: { scoringMode?: RecommendationScoringMode } = {},
): Promise<BenchmarkRunReport> {
  const results: BenchmarkScenarioResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runBenchmarkScenario(scenario, options));
  }
  return {
    benchmarkVersion: BENCHMARK_VERSION,
    generatedAt: new Date().toISOString(),
    scenarioCount: results.length,
    passCount: results.filter((result) => result.passed).length,
    failCount: results.filter((result) => !result.passed).length,
    metrics: calculateAccuracyMetrics(results),
    calibration: calculateConfidenceCalibration(results),
    leaderboard: buildRecommendationLeaderboard(results),
    results,
  };
}

export async function runBenchmarkScenario(
  scenario: RecommendationBenchmarkScenario,
  options: { scoringMode?: RecommendationScoringMode } = {},
): Promise<BenchmarkScenarioResult> {
  const start = Date.now();
  const recommendation = await recommendBestCards({
    merchant: scenario.merchant,
    amount: scenario.purchaseAmount,
    mcc: scenario.purchaseContext.mcc || undefined,
    purchaseChannel: scenario.purchaseContext.channel as any,
    allowedCardSlugs: scenario.userWallet.cardSlugs,
    walletBenefitStates: scenario.walletState,
    cardsOverride: scenario.benefitSnapshot,
    scoringMode: options.scoringMode || "strict_production",
    enrolledBenefitIds: knownIds(scenario.walletState, "enrolled"),
    knownEnrollmentBenefitIds: knownIds(scenario.walletState, "knownEnrollment"),
    activatedBenefitIds: knownIds(scenario.walletState, "activated"),
    knownActivationBenefitIds: knownIds(scenario.walletState, "knownActivation"),
  });
  const top = recommendation.recommendations[0] || null;
  const explanation = explainRecommendationDecision({
    userId: scenario.userWallet.userId,
    merchant: {
      name: scenario.merchant,
      category: scenario.merchantCategory,
      mcc: scenario.purchaseContext.mcc || null,
      confidence: top?.intelligenceConfidence?.factors?.merchant ?? 0.7,
    },
    wallet: {
      source: "manual",
      cardSlugs: scenario.userWallet.cardSlugs,
      benefitStates: scenario.walletState,
    },
    recommendations: recommendation.recommendations as any,
    generatedAt: "2026-07-22T00:00:00.000Z",
  });
  const replay = replayDecisionSnapshot(createDecisionReplaySnapshot(explanation, {
    userId: scenario.userWallet.userId,
    merchant: {
      name: scenario.merchant,
      category: scenario.merchantCategory,
      mcc: scenario.purchaseContext.mcc || null,
      confidence: top?.intelligenceConfidence?.factors?.merchant ?? 0.7,
    },
    wallet: {
      source: "manual",
      cardSlugs: scenario.userWallet.cardSlugs,
      benefitStates: scenario.walletState,
    },
    recommendations: recommendation.recommendations as any,
    generatedAt: "2026-07-22T00:00:00.000Z",
  }));
  const executionTimeMs = Date.now() - start;
  const failures = benchmarkFailures(scenario, top, explanation, replay.matched);
  const actualReward = typeof top?.estValueUSD === "number" ? top.estValueUSD : null;
  const expectedReward = scenario.expected.rewardValueUSD ?? null;
  return {
    scenarioId: scenario.scenarioId,
    category: scenario.category,
    expectedWinningCard: scenario.expected.winningCard,
    actualWinningCard: top?.slug || null,
    expectedBenefit: scenario.expected.benefitId || null,
    actualBenefit: top?.matchedBenefitId || null,
    expectedRewardValueUSD: expectedReward,
    actualRewardValueUSD: actualReward,
    rewardDifference:
      expectedReward === null || actualReward === null
        ? null
        : round(actualReward - expectedReward),
    confidenceDifference: confidenceDifference(top, scenario),
    explanationQuality: explanationQualityScore(explanation, scenario),
    executionTimeMs,
    replayMatched: replay.matched,
    passed: failures.length === 0,
    failures,
    explanation,
  };
}

export function calculateAccuracyMetrics(results: BenchmarkScenarioResult[]): RecommendationAccuracyMetrics {
  const count = Math.max(results.length, 1);
  return {
    recommendationAccuracy: ratio(results.filter((result) => result.expectedWinningCard === result.actualWinningCard).length, count),
    confidenceCalibration: calculateConfidenceCalibration(results).calibrationDrift,
    merchantResolutionAccuracy: ratio(results.filter((result) => !result.failures.includes("merchant_confidence_out_of_range")).length, count),
    walletResolutionAccuracy: ratio(results.filter((result) => !result.failures.includes("wallet_state_missing")).length, count),
    benefitSelectionAccuracy: ratio(results.filter((result) => result.expectedBenefit === result.actualBenefit).length, count),
    replayConsistency: ratio(results.filter((result) => result.replayMatched).length, count),
    explanationCompleteness: round(results.reduce((sum, result) => sum + result.explanationQuality, 0) / count),
    benchmarkPassRate: ratio(results.filter((result) => result.passed).length, count),
  };
}

export function compareBenchmarkRuns(
  baseline: BenchmarkRunReport,
  candidate: BenchmarkRunReport,
): EngineComparisonReport {
  const byScenario = new Map(candidate.results.map((result) => [result.scenarioId, result]));
  const regressions: BenchmarkRegression[] = [];
  const improvements: Array<{ scenarioId: string; reason: string }> = [];
  let winnerChanged = 0;
  let rewardDelta = 0;
  let confidenceDelta = 0;

  for (const base of baseline.results) {
    const next = byScenario.get(base.scenarioId);
    if (!next) continue;
    if (base.actualWinningCard !== next.actualWinningCard) winnerChanged += 1;
    rewardDelta += (next.actualRewardValueUSD || 0) - (base.actualRewardValueUSD || 0);
    confidenceDelta += next.explanation.recommendationConfidence.overall - base.explanation.recommendationConfidence.overall;
    regressions.push(...detectBenchmarkRegressions(base, next));
    if (!base.passed && next.passed) {
      improvements.push({ scenarioId: base.scenarioId, reason: "Benchmark now passes." });
    }
  }

  const compared = Math.max(baseline.results.length, 1);
  return {
    baselineVersion: baseline.benchmarkVersion,
    candidateVersion: candidate.benchmarkVersion,
    scenarioCount: baseline.results.length,
    winnerChanged,
    regressions,
    improvements,
    averageConfidenceDelta: round(confidenceDelta / compared),
    averageRewardDelta: round(rewardDelta / compared),
  };
}

export function detectBenchmarkRegressions(
  baseline: BenchmarkScenarioResult,
  candidate: BenchmarkScenarioResult,
): BenchmarkRegression[] {
  const regressions: BenchmarkRegression[] = [];
  if (baseline.passed && !candidate.passed) {
    regressions.push(regression(candidate.scenarioId, "recommendation_regression", "high", "Previously passing benchmark now fails."));
  }
  if (baseline.actualWinningCard !== candidate.actualWinningCard && candidate.actualWinningCard !== candidate.expectedWinningCard) {
    regressions.push(regression(candidate.scenarioId, "recommendation_regression", "high", "Winner changed away from expected card."));
  }
  if (candidate.confidenceDifference !== null && candidate.confidenceDifference < -0.15) {
    regressions.push(regression(candidate.scenarioId, "confidence_regression", "medium", "Confidence dropped materially."));
  }
  if (baseline.replayMatched && !candidate.replayMatched) {
    regressions.push(regression(candidate.scenarioId, "replay_failure", "high", "Replay no longer matches the original decision."));
  }
  if (baseline.actualBenefit !== candidate.actualBenefit && candidate.actualBenefit !== candidate.expectedBenefit) {
    regressions.push(regression(candidate.scenarioId, "benefit_regression", "medium", "Selected benefit changed away from expected benefit."));
  }
  return regressions;
}

export function calculateConfidenceCalibration(results: BenchmarkScenarioResult[]): ConfidenceCalibrationReport {
  const distribution = { high: 0, medium: 0, low: 0 };
  let overconfident = 0;
  let underconfident = 0;
  for (const result of results) {
    const label = result.explanation.recommendationConfidence.label;
    distribution[label] += 1;
    if (!result.passed && result.explanation.recommendationConfidence.overall >= 0.8) overconfident += 1;
    if (result.passed && result.explanation.recommendationConfidence.overall < 0.58) underconfident += 1;
  }
  const total = Math.max(results.length, 1);
  return {
    overconfident,
    underconfident,
    calibrationDrift: round(1 - (overconfident + underconfident) / total),
    distribution,
  };
}

export function buildRecommendationLeaderboard(results: BenchmarkScenarioResult[]): RecommendationLeaderboard {
  return {
    mostAccurateCategories: rankedCategories(results, "passRate").slice(0, 5),
    lowestConfidenceCategories: rankedCategories(results, "confidence").slice(0, 5),
    commonFailures: countBy(results.flatMap((result) => result.failures)).map(([failure, count]) => ({ failure, count })).slice(0, 10),
    frequentlySelectedCards: countBy(results.map((result) => result.actualWinningCard || "none")).map(([cardSlug, count]) => ({ cardSlug, count })).slice(0, 10),
    frequentlySelectedBenefits: countBy(results.map((result) => result.actualBenefit || "none")).map(([benefitId, count]) => ({ benefitId, count })).slice(0, 10),
    highestValueRecommendations: [...results]
      .sort((a, b) => (b.actualRewardValueUSD || 0) - (a.actualRewardValueUSD || 0))
      .slice(0, 10)
      .map((result) => ({
        scenarioId: result.scenarioId,
        cardSlug: result.actualWinningCard,
        valueUSD: result.actualRewardValueUSD || 0,
      })),
  };
}

export function recommendationBenchmarkScenarios(): RecommendationBenchmarkScenario[] {
  const baseCards = benchmarkCards();
  const scenarios: RecommendationBenchmarkScenario[] = [
    scenario("restaurant-dining-gold", "restaurants", "Local Bistro", "restaurants", 100, ["amex-gold", "flat-two"], baseCards, [], { winningCard: "amex-gold", rewardValueUSD: 6 }),
    scenario("generic-grocery-chase", "groceries", "Neighborhood Grocery", "groceries", 100, ["chase-grocery", "flat-two"], baseCards, [], { winningCard: "chase-grocery", rewardValueUSD: 3 }),
    scenario("amazon-checkout-credit", "amazon", "Amazon", "online_shopping", 80, ["amazon-prime", "flat-two"], baseCards, [state("u1", "amazon-prime", "amazon-prime:merchant-credit:amazon-credit", 20, 20)], { winningCard: "amazon-prime", benefitId: "amazon-prime:merchant-credit:amazon-credit", rewardValueUSD: 20.8 }),
    scenario("whole-foods-parent-amazon", "parent_merchant", "Whole Foods Market", "groceries", 50, ["amazon-prime", "chase-grocery"], baseCards, [state("u1", "amazon-prime", "amazon-prime:merchant-credit:amazon-credit", 20, 20)], { winningCard: "amazon-prime", benefitId: "amazon-prime:merchant-credit:amazon-credit", rewardValueUSD: 20.5 }),
    scenario("delta-flight-travel", "flights", "Delta", "travel", 300, ["travel-card", "flat-two"], baseCards, [], { winningCard: "travel-card", rewardValueUSD: 9 }),
    scenario("hilton-hotel-travel", "hotels", "Hilton", "travel", 200, ["travel-card", "flat-two"], baseCards, [], { winningCard: "travel-card", rewardValueUSD: 6 }),
    scenario("costco-retail-flat", "retail", "Costco", "retail", 120, ["flat-two"], baseCards, [], { winningCard: "flat-two", rewardValueUSD: 2.4 }),
    scenario("streaming-credit-active", "streaming", "Netflix", "streaming", 20, ["streaming-card", "flat-two"], baseCards, [state("u1", "streaming-card", "streaming-card:recurring-credit:streaming-credit", 10, 10)], { winningCard: "streaming-card", benefitId: "streaming-card:recurring-credit:streaming-credit", rewardValueUSD: 10.2 }),
    scenario("expired-credit-rejected", "expired_benefits", "Netflix", "streaming", 20, ["expired-streaming", "flat-two"], baseCards, [state("u1", "expired-streaming", "expired-streaming:recurring-credit:expired-streaming-credit", 0, 10)], { winningCard: "flat-two", rewardValueUSD: 0.4 }),
    scenario("spend-cap-remaining", "spend_cap_scenarios", "Neighborhood Grocery", "groceries", 100, ["capped-grocery", "flat-two"], baseCards, [spendState("u1", "capped-grocery", "capped-grocery:reward:groceries:5", 20, 20)], { winningCard: "capped-grocery", rewardValueUSD: 1.8 }),
    scenario("spend-cap-exhausted", "spend_cap_scenarios", "Neighborhood Grocery", "groceries", 100, ["capped-grocery", "flat-two"], baseCards, [spendState("u1", "capped-grocery", "capped-grocery:reward:groceries:5", 0, 20)], { winningCard: "flat-two", rewardValueUSD: 2 }),
    scenario("unknown-merchant-flat", "unknown_merchant", "Mystery Shop", "other", 50, ["flat-two"], baseCards, [], { winningCard: "flat-two", rewardValueUSD: 1 }),
    scenario("wallet-state-missing-credit", "wallet_state_missing", "Amazon", "online_shopping", 80, ["amazon-prime", "flat-two"], baseCards, [], { winningCard: "flat-two", rewardValueUSD: 1.6 }),
    scenario("uber-eats-dining", "merchant_alias", "Uber Eats", "restaurants", 60, ["amex-gold", "flat-two"], baseCards, [], { winningCard: "amex-gold", rewardValueUSD: 3.6 }),
    scenario("drugstore-flat", "drugstores", "CVS", "drugstores", 40, ["drugstore-card", "flat-two"], baseCards, [], { winningCard: "drugstore-card", rewardValueUSD: 1.2 }),
    scenario("gas-card", "gas", "Shell", "gas", 45, ["gas-card", "flat-two"], baseCards, [], { winningCard: "gas-card", rewardValueUSD: 1.35 }),
  ];
  const categories: BenchmarkCategory[] = [
    "restaurants",
    "groceries",
    "travel",
    "flights",
    "hotels",
    "gas",
    "streaming",
    "amazon",
    "retail",
    "drugstores",
    "rotating_categories",
    "multiple_benefit_conflicts",
    "spend_cap_scenarios",
    "expired_benefits",
    "unknown_merchant",
    "low_confidence",
    "wallet_state_missing",
    "merchant_alias",
    "parent_merchant",
    "billing_descriptor",
  ];
  for (let i = 0; i < 100; i += 1) {
    const template = scenarios[i % scenarios.length];
    scenarios.push({
      ...template,
      scenarioId: `${template.scenarioId}-variant-${i + 1}`,
      category: categories[i % categories.length],
      purchaseAmount: template.purchaseAmount + (i % 5),
      expected: {
        ...template.expected,
        rewardValueUSD:
          template.expected.rewardValueUSD === null || template.expected.rewardValueUSD === undefined
            ? template.expected.rewardValueUSD
            : round(template.expected.rewardValueUSD + ((i % 5) * ((template.expected.rewardValueUSD || 0) / Math.max(template.purchaseAmount, 1)))),
      },
      notes: [...template.notes, "Deterministic generated benchmark variant."],
    });
  }
  return scenarios;
}

export function benchmarkCards() {
  return [
    card("amex-gold", "Amex Gold", "American Express", { rewardsByCategory: [{ keys: ["restaurants", "dining"], rate: "4x", unit: "points" }] }),
    card("chase-grocery", "Chase Grocery", "Chase", { rewardsByCategory: [{ keys: ["groceries"], rate: "3%", unit: "cash" }] }),
    card("travel-card", "Travel Card", "Chase", { rewardsByCategory: [{ keys: ["travel"], rate: "3%", unit: "cash" }] }),
    card("flat-two", "Flat Two Percent", "Other", { rewardsFlat: [{ rate: "2%", unit: "cash" }] }),
    card("amazon-prime", "Amazon Prime Card", "Chase", { rewardsFlat: [{ rate: "1%", unit: "cash" }], merchantCredits: [{ id: "amazon-credit", label: "$20 Amazon credit", amountUSD: 20, period: "month", eligibleWhen: { merchantPatterns: ["amazon", "amazon group"] }, confidence: 0.95, sourceUrl: "https://issuer.example/amazon" }] }),
    card("streaming-card", "Streaming Card", "Issuer", { rewardsFlat: [{ rate: "1%", unit: "cash" }], recurringCredits: [{ id: "streaming-credit", label: "$10 streaming credit", amountUSD: 10, period: "month", eligibleWhen: { merchantPatterns: ["netflix"], channels: ["online"] }, confidence: 0.95 }] }),
    card("expired-streaming", "Expired Streaming", "Issuer", { rewardsFlat: [{ rate: "1%", unit: "cash" }], recurringCredits: [{ id: "expired-streaming-credit", label: "$10 streaming credit", amountUSD: 10, period: "month", eligibleWhen: { merchantPatterns: ["netflix"], channels: ["online"] }, confidence: 0.95 }] }),
    card("capped-grocery", "Capped Grocery", "Other", { rewardsFlat: [{ rate: "1%", unit: "cash" }], rewardsByCategory: [{ keys: ["groceries"], rate: "5%", unit: "cash", capPerPeriodUSD: 20, period: "month" }] }),
    card("drugstore-card", "Drugstore Card", "Other", { rewardsByCategory: [{ keys: ["drugstores"], rate: "3%", unit: "cash" }] }),
    card("gas-card", "Gas Card", "Other", { rewardsByCategory: [{ keys: ["gas"], rate: "3%", unit: "cash" }] }),
  ];
}

function benchmarkFailures(
  scenario: RecommendationBenchmarkScenario,
  top: any,
  explanation: DecisionExplanation,
  replayMatched: boolean,
) {
  const failures: string[] = [];
  if ((top?.slug || null) !== scenario.expected.winningCard) failures.push("winning_card_mismatch");
  if (
    scenario.expected.benefitId !== undefined &&
    (top?.matchedBenefitId || null) !== (scenario.expected.benefitId || null)
  ) {
    failures.push("benefit_mismatch");
  }
  if (
    scenario.expected.rewardValueUSD !== undefined &&
    scenario.expected.rewardValueUSD !== null &&
    top?.estValueUSD !== undefined &&
    Math.abs(top.estValueUSD - scenario.expected.rewardValueUSD) > 0.25
  ) {
    failures.push("reward_value_mismatch");
  }
  const range = scenario.expected.confidenceRange;
  if (range && (explanation.recommendationConfidence.overall < range.min || explanation.recommendationConfidence.overall > range.max)) failures.push("confidence_out_of_range");
  for (const expected of scenario.expected.explanationMustInclude || []) {
    if (!JSON.stringify(explanation.evidence).toLowerCase().includes(expected.toLowerCase())) failures.push("explanation_missing_expected_evidence");
  }
  if (!replayMatched) failures.push("replay_failed");
  if (explanationQualityScore(explanation, scenario) < 0.75) failures.push("explanation_incomplete");
  return failures;
}

function explanationQualityScore(explanation: DecisionExplanation, scenario: RecommendationBenchmarkScenario) {
  const checks = [
    explanation.evidence.merchant.length > 0,
    explanation.evidence.scoring.length > 0,
    explanation.evidence.confidence.length > 0,
    scenario.expected.benefitId ? explanation.evidence.benefit.length > 0 : true,
    scenario.walletState.length ? explanation.evidence.wallet.length > 2 : true,
    explanation.replayHash.length > 0,
  ];
  return ratio(checks.filter(Boolean).length, checks.length);
}

function confidenceDifference(top: any, scenario: RecommendationBenchmarkScenario) {
  const range = scenario.expected.confidenceRange;
  const score = top?.intelligenceConfidence?.score;
  if (!range || typeof score !== "number") return null;
  if (score < range.min) return round(score - range.min);
  if (score > range.max) return round(score - range.max);
  return 0;
}

function knownIds(states: CanonicalWalletBenefitState[], kind: "enrolled" | "knownEnrollment" | "activated" | "knownActivation") {
  return states
    .filter((state) => {
      if (kind === "enrolled") return state.enrollmentStatus === "enrolled";
      if (kind === "knownEnrollment") return !["unknown", "not_required"].includes(state.enrollmentStatus);
      if (kind === "activated") return state.activationStatus === "activated";
      return !["unknown", "not_required"].includes(state.activationStatus);
    })
    .map((state) => state.benefitId);
}

function scenario(
  scenarioId: string,
  category: BenchmarkCategory,
  merchant: string,
  merchantCategory: string,
  purchaseAmount: number,
  cardSlugs: string[],
  benefitSnapshot: any[],
  walletState: CanonicalWalletBenefitState[],
  expected: RecommendationBenchmarkScenario["expected"],
): RecommendationBenchmarkScenario {
  return {
    scenarioId,
    category,
    merchant,
    merchantCategory,
    purchaseAmount,
    purchaseContext: { channel: "online" },
    userWallet: { userId: "benchmark-user", cardSlugs },
    walletState,
    benefitSnapshot,
    expected: {
      confidenceRange: { min: 0.45, max: 1 },
      explanationMustInclude: [],
      ...expected,
    },
    notes: [],
  };
}

function card(slug: string, name: string, issuer: string, data: Record<string, unknown>) {
  return {
    slug,
    name,
    issuer,
    sourceUrl: `https://issuer.example/${slug}`,
    lastVerified: "2026-07-01T00:00:00.000Z",
    productionEligible: true,
    ...data,
  };
}

function state(userId: string, cardSlug: string, benefitId: string, remainingValue: number, cycleValueLimit: number) {
  return canonicalizeWalletBenefitState({
    userId,
    cardSlug,
    benefitId,
    enrollmentStatus: "not_required",
    activationStatus: "not_required",
    remainingValue,
    cycleValueLimit,
    cycleFrequency: "monthly",
    confidenceSource: "user_verified",
  });
}

function spendState(userId: string, cardSlug: string, benefitId: string, remainingSpendCap: number, cycleSpendLimit: number) {
  return canonicalizeWalletBenefitState({
    userId,
    cardSlug,
    benefitId,
    enrollmentStatus: "not_required",
    activationStatus: "not_required",
    remainingSpendCap,
    cycleSpendLimit,
    cycleFrequency: "monthly",
    confidenceSource: "user_verified",
  });
}

function regression(scenarioId: string, type: BenchmarkRegression["type"], severity: BenchmarkRegression["severity"], message: string): BenchmarkRegression {
  return { scenarioId, type, severity, message };
}

function rankedCategories(results: BenchmarkScenarioResult[], mode: "passRate" | "confidence") {
  const categories = new Map<BenchmarkCategory, BenchmarkScenarioResult[]>();
  for (const result of results) {
    categories.set(result.category, [...(categories.get(result.category) || []), result]);
  }
  return Array.from(categories.entries())
    .map(([category, categoryResults]) =>
      mode === "passRate"
        ? { category, passRate: ratio(categoryResults.filter((result) => result.passed).length, categoryResults.length) }
        : { category, averageConfidence: round(categoryResults.reduce((sum, result) => sum + result.explanation.recommendationConfidence.overall, 0) / categoryResults.length) },
    )
    .sort((a: any, b: any) => mode === "passRate" ? b.passRate - a.passRate : a.averageConfidence - b.averageConfidence) as any;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function ratio(numerator: number, denominator: number) {
  return round(numerator / Math.max(denominator, 1));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
