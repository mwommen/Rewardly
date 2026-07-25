import type { ScenarioAssertionResult } from "./recommendationScenario.types";
import type {
  RecommendationScenario,
  ScenarioValidationResult,
} from "./recommendationScenario.types";
import {
  recommendationCoverageRequirements,
  type CoverageRequirement,
} from "./recommendationCoverageRequirements";

export type CoverageBranchStatus = CoverageRequirement & {
  count: number;
  scenarioIds: string[];
  curatedScenarioIds: string[];
  passed: boolean;
};

export type RecommendationCoverageSummary = {
  dimensions: Record<string, Record<string, number>>;
  scenarioIdsByDimension: Record<string, Record<string, string[]>>;
  curatedScenarioIdsByDimension: Record<string, Record<string, string[]>>;
  branchStatuses: CoverageBranchStatus[];
  uncoveredRequiredBranches: CoverageBranchStatus[];
  thresholdFailures: string[];
  byRuleType: Record<string, number>;
  byPurchaseChannel: Record<string, number>;
  byClassificationSource: Record<string, number>;
  byConfidenceBand: Record<string, number>;
  byWalletSize: Record<string, number>;
  byCurrency: Record<string, number>;
  byRejectedReason: Record<string, number>;
};

export function buildRecommendationCoverageSummary(
  scenarios: RecommendationScenario[],
  results: ScenarioValidationResult[],
  input: {
    invariantAssertions?: ScenarioAssertionResult[];
    metamorphicAssertions?: ScenarioAssertionResult[];
  } = {},
): RecommendationCoverageSummary {
  const collector = createCollector();
  const resultById = new Map(results.map((result) => [result.scenarioId, result]));

  scenarios.forEach((scenario) => {
    const result = resultById.get(scenario.id);
    const curated = scenario.tags.includes("curated");
    add(collector, "rule_type", scenario.expected.winnerRuleType, scenario.id, curated);
    if (scenario.tags.includes("rotating")) {
      add(collector, "rule_type", "rotating_category", scenario.id, curated);
    }
    if (
      result?.decisionTrace.winningCard?.winningRule?.sourceKind ===
      "reward_rotating"
    ) {
      add(collector, "rule_type", "rotating_category", scenario.id, curated);
    }
    if (
      result?.decisionTrace.winningCard?.winningRule?.merchantRestrictions
        .length
    ) {
      add(collector, "rule_type", "merchant_specific", scenario.id, curated);
    }
    add(collector, "purchase_channel", scenario.purchase.channel, scenario.id, curated);
    add(collector, "currency", scenario.purchase.currency, scenario.id, curated);
    add(collector, "wallet_size", walletSizeBranch(scenario.wallet.cards.length), scenario.id, curated);
    add(collector, "classification", classificationSourceBranch(scenario), scenario.id, curated);
    add(collector, "classification_source", classificationSourceBranch(scenario), scenario.id, curated);
    add(collector, "classification", confidenceBranch(scenario.classification.confidence), scenario.id, curated);
    add(collector, "confidence_band", confidenceBranch(scenario.classification.confidence).replace("_confidence", ""), scenario.id, curated);
    addRankingCoverage(collector, scenario, result, curated);
    addDateCoverage(collector, scenario, curated);
    addWalletStateCoverage(collector, scenario, curated);
    addRejectionCoverage(collector, scenario, result, curated);
  });

  for (const assertion of input.invariantAssertions || []) {
    if (/wallet order independence/i.test(assertion.name)) {
      add(collector, "wallet", "wallet_reordered", assertion.name, true);
    }
    if (/wallet-only/i.test(assertion.name)) {
      add(collector, "wallet", "non_owned_card_prevention", assertion.name, true);
    }
    if (/explanation/i.test(assertion.name)) {
      add(collector, "explanation", "explanation_alignment", assertion.name, true);
    }
  }

  for (const assertion of input.metamorphicAssertions || []) {
    if (/remove-winning-card/.test(assertion.name)) {
      add(collector, "wallet", "winning_card_removed", assertion.name, true);
    }
    if (/reorder-wallet-cards/.test(assertion.name)) {
      add(collector, "wallet", "wallet_reordered", assertion.name, true);
    }
    if (/add-irrelevant-low-value-card/.test(assertion.name)) {
      add(collector, "wallet", "irrelevant_card_added", assertion.name, true);
    }
    if (/change-channel-away-from-issuer-portal/.test(assertion.name)) {
      add(collector, "purchase_channel", "incompatible_channel", assertion.name, true);
      add(collector, "eligibility", "incompatible_channel", assertion.name, true);
    }
    if (/change-merchant-retain-category/.test(assertion.name)) {
      add(collector, "eligibility", "merchant_mismatch", assertion.name, true);
    }
  }

  const branchStatuses = recommendationCoverageRequirements.map((requirement) => {
    const count = collector.dimensions[requirement.dimension]?.[requirement.branch] || 0;
    const scenarioIds =
      collector.scenarioIdsByDimension[requirement.dimension]?.[requirement.branch] || [];
    const curatedScenarioIds =
      collector.curatedScenarioIdsByDimension[requirement.dimension]?.[requirement.branch] || [];
    return {
      ...requirement,
      count,
      scenarioIds,
      curatedScenarioIds,
      passed:
        count >= requirement.minimumCount &&
        (!requirement.curatedRequired || curatedScenarioIds.length > 0),
    };
  });
  const uncoveredRequiredBranches = branchStatuses.filter(
    (status) => status.required && !status.passed,
  );

  return {
    dimensions: collector.dimensions,
    scenarioIdsByDimension: collector.scenarioIdsByDimension,
    curatedScenarioIdsByDimension: collector.curatedScenarioIdsByDimension,
    branchStatuses,
    uncoveredRequiredBranches,
    thresholdFailures: uncoveredRequiredBranches.map(
      (branch) => `${branch.dimension}/${branch.branch}`,
    ),
    byRuleType: collector.dimensions.rule_type || {},
    byPurchaseChannel: collector.dimensions.purchase_channel || {},
    byClassificationSource: collector.dimensions.classification_source || {},
    byConfidenceBand: collector.dimensions.confidence_band || {},
    byWalletSize: collector.dimensions.wallet_size || {},
    byCurrency: collector.dimensions.currency || {},
    byRejectedReason: collector.dimensions.rejected_reason || {},
  };
}

function createCollector() {
  return {
    dimensions: {} as Record<string, Record<string, number>>,
    scenarioIdsByDimension: {} as Record<string, Record<string, string[]>>,
    curatedScenarioIdsByDimension: {} as Record<string, Record<string, string[]>>,
  };
}

function add(
  collector: ReturnType<typeof createCollector>,
  dimension: string,
  branch: string,
  scenarioId: string,
  curated: boolean,
) {
  collector.dimensions[dimension] ||= {};
  collector.scenarioIdsByDimension[dimension] ||= {};
  collector.curatedScenarioIdsByDimension[dimension] ||= {};
  collector.dimensions[dimension][branch] = (collector.dimensions[dimension][branch] || 0) + 1;
  collector.scenarioIdsByDimension[dimension][branch] ||= [];
  collector.scenarioIdsByDimension[dimension][branch].push(scenarioId);
  if (curated) {
    collector.curatedScenarioIdsByDimension[dimension][branch] ||= [];
    collector.curatedScenarioIdsByDimension[dimension][branch].push(scenarioId);
  }
}

function addRankingCoverage(
  collector: ReturnType<typeof createCollector>,
  scenario: RecommendationScenario,
  result: ScenarioValidationResult | undefined,
  curated: boolean,
) {
  if (scenario.tags.includes("tie-breaker")) {
    add(collector, "ranking_path", "exact_value_tie", scenario.id, curated);
    add(collector, "ranking_path", "final_deterministic_tie_break", scenario.id, curated);
    return;
  }
  if (
    result?.decisionTrace.winningCard &&
    result.decisionTrace.runnerUp &&
    result.decisionTrace.winningCard.estimatedValueUSD >
      result.decisionTrace.runnerUp.estimatedValueUSD
  ) {
    add(collector, "ranking_path", "clear_reward_value_winner", scenario.id, curated);
  }
  if (
    result?.decisionTrace.winningCard &&
    result.decisionTrace.runnerUp &&
    result.decisionTrace.winningCard.estimatedValueUSD ===
      result.decisionTrace.runnerUp.estimatedValueUSD &&
    result.decisionTrace.winningCard.confidence > result.decisionTrace.runnerUp.confidence
  ) {
    add(collector, "ranking_path", "confidence_tie_break", scenario.id, curated);
  }
}

function addDateCoverage(
  collector: ReturnType<typeof createCollector>,
  scenario: RecommendationScenario,
  curated: boolean,
) {
  if (scenario.id.includes("before-start") || scenario.id.includes("before-effective")) {
    add(collector, "date_boundary", "before_effective", scenario.id, curated);
  }
  if (scenario.id.includes("quarter-start")) {
    add(collector, "date_boundary", "exactly_on_effective", scenario.id, curated);
  }
  if (scenario.id.includes("before-expiration")) {
    add(collector, "date_boundary", "before_expiration", scenario.id, curated);
  }
  if (scenario.id.includes("quarter-end")) {
    add(collector, "date_boundary", "expiration_boundary", scenario.id, curated);
  }
  if (scenario.id.includes("after-quarter")) {
    add(collector, "date_boundary", "after_expiration", scenario.id, curated);
  }
}

function addWalletStateCoverage(
  collector: ReturnType<typeof createCollector>,
  scenario: RecommendationScenario,
  curated: boolean,
) {
  for (const state of scenario.walletBenefitStates || []) {
    if (state.remainingSpendCap !== null) {
      if (state.remainingSpendCap === 0) {
        add(collector, "cap_state", "exhausted_cap", scenario.id, curated);
      } else if (state.remainingSpendCap === state.cycleSpendLimit) {
        add(collector, "cap_state", "unused_cap", scenario.id, curated);
      } else {
        add(collector, "cap_state", "partially_used_cap", scenario.id, curated);
      }
      if (state.remainingSpendCap > 0 && scenario.purchase.amount > state.remainingSpendCap) {
        add(collector, "cap_state", "partial_purchase_over_cap", scenario.id, curated);
      }
    } else {
      add(collector, "cap_state", "no_cap", scenario.id, curated);
    }
    if (state.remainingValue !== null) {
      if (state.remainingValue === 0) {
        add(collector, "credit_state", "exhausted_credit", scenario.id, curated);
      } else if (state.remainingValue === state.cycleValueLimit) {
        add(collector, "credit_state", "unused_credit", scenario.id, curated);
      } else {
        add(collector, "credit_state", "partially_used_credit", scenario.id, curated);
      }
      if (scenario.purchase.amount <= state.remainingValue) {
        add(collector, "credit_state", "purchase_below_remaining_credit", scenario.id, curated);
      } else {
        add(collector, "credit_state", "purchase_above_remaining_credit", scenario.id, curated);
      }
    }
  }
}

function addRejectionCoverage(
  collector: ReturnType<typeof createCollector>,
  scenario: RecommendationScenario,
  result: ScenarioValidationResult | undefined,
  curated: boolean,
) {
  result?.decisionTrace.evaluatedCards.forEach((card) => {
    card.trace.forEach((trace) => {
      if (trace.applicable) add(collector, "eligibility", "eligible_rule", scenario.id, curated);
      trace.rejectionReasons.forEach((reason) => {
        add(collector, "rejected_reason", reason, scenario.id, curated);
        const normalized = reason.toLowerCase();
        if (normalized.includes("expired")) add(collector, "eligibility", "expired_rule", scenario.id, curated);
        if (normalized.includes("not_effective")) add(collector, "eligibility", "not_yet_effective_rule", scenario.id, curated);
        if (normalized.includes("activation")) add(collector, "eligibility", "missing_activation", scenario.id, curated);
        if (normalized.includes("enrollment")) add(collector, "eligibility", "missing_enrollment", scenario.id, curated);
        if (normalized.includes("exhausted")) add(collector, "eligibility", "exhausted_cap", scenario.id, curated);
        if (normalized.includes("channel")) add(collector, "eligibility", "incompatible_channel", scenario.id, curated);
        if (normalized.includes("restriction")) {
          addRestrictionMismatchCoverage(collector, scenario, trace, curated);
        }
      });
    });
  });
}

function addRestrictionMismatchCoverage(
  collector: ReturnType<typeof createCollector>,
  scenario: RecommendationScenario,
  trace: { sourceKind: string; label: string; benefitId: string; ruleId: string },
  curated: boolean,
) {
  const expectedReasons = scenario.expected.expectedRejectedRules || [];
  const expected = expectedReasons.find(
    (item) =>
      item.benefitId === trace.benefitId || trace.ruleId.includes(item.benefitId),
  );
  if (expected?.reason === "merchant_mismatch") {
    add(collector, "eligibility", "merchant_mismatch", scenario.id, curated);
    return;
  }
  if (expected?.reason === "category_mismatch") {
    add(collector, "eligibility", "category_mismatch", scenario.id, curated);
    return;
  }
  if (trace.sourceKind === "merchant_credit") {
    add(collector, "eligibility", "merchant_mismatch", scenario.id, curated);
    return;
  }
  if (
    trace.sourceKind === "reward_category" ||
    trace.sourceKind === "reward_rotating"
  ) {
    add(collector, "eligibility", "category_mismatch", scenario.id, curated);
  }
}

function walletSizeBranch(size: number) {
  if (size === 1) return "one_card_wallet";
  if (size === 2) return "two_card_wallet";
  return "three_or_more_card_wallet";
}

function classificationSourceBranch(scenario: RecommendationScenario) {
  const source = scenario.classification.source;
  if (source === "merchant_category_code") return "mcc_derived";
  if (source === "verified_merchant_mapping" || source === "domain_mapping") return "verified";
  return source;
}

function confidenceBranch(confidence: number) {
  if (confidence >= 0.85) return "high_confidence";
  if (confidence >= 0.65) return "medium_confidence";
  return "low_confidence";
}
