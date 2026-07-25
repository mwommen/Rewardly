import type { WalletDecisionResult, WalletDecisionWinningRule } from "../services/walletDecisionEngine";
import type {
  RecommendationScenario,
  ScenarioAssertionResult,
  ScenarioRuleType,
} from "./recommendationScenario.types";

const REJECTION_MAP: Record<string, string[]> = {
  category_mismatch: ["RULE_DOES_NOT_MATCH_PURCHASE", "BENEFIT_RESTRICTION_INCOMPATIBLE"],
  merchant_mismatch: ["RULE_DOES_NOT_MATCH_PURCHASE", "BENEFIT_RESTRICTION_INCOMPATIBLE"],
  channel_mismatch: ["BENEFIT_PURCHASE_CHANNEL_INCOMPATIBLE"],
  expired: ["BENEFIT_EXPIRED"],
  not_yet_effective: ["BENEFIT_NOT_EFFECTIVE"],
  enrollment_required: ["BENEFIT_ENROLLMENT_REQUIRED", "BENEFIT_USER_STATUS_UNKNOWN"],
  activation_required: ["BENEFIT_ACTIVATION_REQUIRED", "BENEFIT_USER_STATUS_UNKNOWN"],
  cap_exhausted: ["RULE_HAS_NO_ESTIMATED_VALUE", "exhausted"],
  credit_exhausted: ["RULE_HAS_NO_ESTIMATED_VALUE", "exhausted"],
  wallet_state_missing: ["wallet_state_required", "BENEFIT_USER_STATUS_UNKNOWN"],
  country_restriction: ["BENEFIT_RESTRICTION_INCOMPATIBLE"],
  lower_value: [],
  not_owned: [],
  other: [],
};

export function assertRecommendationScenario(
  scenario: RecommendationScenario,
  result: WalletDecisionResult,
): ScenarioAssertionResult[] {
  const assertions: ScenarioAssertionResult[] = [];
  const walletSlugs = new Set(scenario.wallet.cards.map((card) => card.cardSlug));
  const explanation = result.explanation || "";

  push(assertions, "wallet integrity: every evaluated card is owned", {
    expected: Array.from(walletSlugs).sort(),
    actual: result.evaluatedCards.map((item) => item.card.slug).sort(),
    passed: result.evaluatedCards.every((item) => walletSlugs.has(item.card.slug)),
  });
  push(assertions, "wallet integrity: winner is owned", {
    expected: Array.from(walletSlugs),
    actual: result.winningCard?.card.slug,
    passed: !result.winningCard || walletSlugs.has(result.winningCard.card.slug),
  });
  push(assertions, "wallet integrity: runner-up is owned", {
    expected: Array.from(walletSlugs),
    actual: result.runnerUp?.card.slug,
    passed: !result.runnerUp || walletSlugs.has(result.runnerUp.card.slug),
  });
  push(assertions, "winner card matches expected", {
    expected: scenario.expected.winnerCardSlug,
    actual: result.winningCard?.card.slug,
    passed: result.winningCard?.card.slug === scenario.expected.winnerCardSlug,
  });
  push(assertions, "winner benefit matches expected", {
    expected: scenario.expected.winnerBenefitId,
    actual: result.winningRule?.benefitId,
    passed: result.winningRule?.benefitId === scenario.expected.winnerBenefitId,
  });
  push(assertions, "winner rule type matches expected", {
    expected: scenario.expected.winnerRuleType,
    actual: ruleTypeFor(result.winningRule),
    passed: ruleTypeFor(result.winningRule) === scenario.expected.winnerRuleType,
  });
  if (scenario.expected.runnerUpCardSlug) {
    push(assertions, "runner-up card matches expected", {
      expected: scenario.expected.runnerUpCardSlug,
      actual: result.runnerUp?.card.slug,
      passed: result.runnerUp?.card.slug === scenario.expected.runnerUpCardSlug,
    });
  }
  if (scenario.expected.runnerUpBenefitId) {
    push(assertions, "runner-up benefit matches expected", {
      expected: scenario.expected.runnerUpBenefitId,
      actual: result.runnerUp?.winningRule?.benefitId,
      passed: result.runnerUp?.winningRule?.benefitId === scenario.expected.runnerUpBenefitId,
    });
  }
  if (scenario.expected.expectedReward?.quantity !== undefined) {
    const tolerance = scenario.expected.expectedReward.tolerance ?? 0.01;
    push(assertions, "reward quantity matches within tolerance", {
      expected: scenario.expected.expectedReward.quantity,
      actual: result.estimatedReward?.quantity,
      passed:
        typeof result.estimatedReward?.quantity === "number" &&
        Math.abs(result.estimatedReward.quantity - scenario.expected.expectedReward.quantity) <=
          tolerance,
    });
  }
  if (scenario.expected.expectedReward?.cashEquivalent !== undefined) {
    const tolerance = scenario.expected.expectedReward.tolerance ?? 0.01;
    push(assertions, "cash-equivalent value matches within tolerance", {
      expected: scenario.expected.expectedReward.cashEquivalent,
      actual: result.estimatedReward?.valueUSD,
      passed:
        typeof result.estimatedReward?.valueUSD === "number" &&
        Math.abs(result.estimatedReward.valueUSD - scenario.expected.expectedReward.cashEquivalent) <=
          tolerance,
    });
  }
  if (scenario.expected.confidence?.level) {
    push(assertions, "confidence level matches expected", {
      expected: scenario.expected.confidence.level,
      actual: result.confidence.label,
      passed: result.confidence.label === scenario.expected.confidence.level,
    });
  }
  if (scenario.expected.confidence?.minScore !== undefined) {
    push(assertions, "confidence score is at or above minimum", {
      expected: scenario.expected.confidence.minScore,
      actual: result.confidence.score,
      passed: result.confidence.score >= scenario.expected.confidence.minScore,
    });
  }
  if (scenario.expected.confidence?.maxScore !== undefined) {
    push(assertions, "confidence score is at or below maximum", {
      expected: scenario.expected.confidence.maxScore,
      actual: result.confidence.score,
      passed: result.confidence.score <= scenario.expected.confidence.maxScore,
    });
  }
  for (const text of scenario.expected.explanationMustContain || []) {
    push(assertions, `explanation contains "${text}"`, {
      expected: text,
      actual: explanation,
      passed: explanation.toLowerCase().includes(text.toLowerCase()),
    });
  }
  for (const text of scenario.expected.explanationMustNotContain || []) {
    push(assertions, `explanation does not contain "${text}"`, {
      expected: `not ${text}`,
      actual: explanation,
      passed: !explanation.toLowerCase().includes(text.toLowerCase()),
    });
  }
  for (const walletCard of scenario.wallet.cards) {
    const cardName = result.evaluatedCards.find((item) => item.card.slug === walletCard.cardSlug)
      ?.card.name;
    if (cardName) continue;
  }
  result.evaluatedCards.forEach((score) => {
    score.trace.forEach((trace) => {
      push(assertions, `audit metadata exists for ${score.card.slug}:${trace.benefitId}`, {
        expected: "rule id, benefit id, confidence, valuation",
        actual: trace,
        passed:
          Boolean(trace.ruleId) &&
          Boolean(trace.benefitId) &&
          typeof trace.confidence === "number" &&
          Boolean(trace.valuation),
      });
    });
  });
  push(assertions, "audit trace has decision ID", {
    expected: "decision ID",
    actual: result.auditLog.decisionId,
    passed: Boolean(result.auditLog.decisionId),
  });
  push(assertions, "audit trace has timestamp", {
    expected: "timestamp",
    actual: result.auditLog.timestamp,
    passed: Boolean(result.auditLog.timestamp) && !Number.isNaN(Date.parse(result.auditLog.timestamp)),
  });
  push(assertions, "specific winning rule avoids generic fallback language", {
    expected: "specific explanation",
    actual: explanation,
    passed:
      !result.winningRule ||
      !/verified wallet rewards|calculated after checkout total/i.test(explanation),
  });
  push(assertions, "explanation names winning card before runner-up", {
    expected: result.winningCard?.card.name,
    actual: explanation,
    passed:
      !result.winningCard?.card.name ||
      !result.runnerUp?.card.name ||
      explanation.indexOf(result.winningCard.card.name) >= 0 &&
        (explanation.indexOf(result.runnerUp.card.name) < 0 ||
          explanation.indexOf(result.winningCard.card.name) <
            explanation.indexOf(result.runnerUp.card.name)),
  });
  assertExpectedRejections(scenario, result, assertions);
  return assertions;
}

export function ruleTypeFor(rule: WalletDecisionWinningRule | null | undefined): ScenarioRuleType | null {
  if (!rule) return null;
  if (rule.earningUnit === "flat_credit") return "statement_credit";
  if (rule.merchantRestrictions.length) return "merchant_specific";
  if (/portal|issuer_travel_portal|travel_portal/i.test(rule.applicableCategories.join(" "))) {
    return "portal";
  }
  if (rule.sourceKind === "reward_flat") return "base";
  return "category";
}

function assertExpectedRejections(
  scenario: RecommendationScenario,
  result: WalletDecisionResult,
  assertions: ScenarioAssertionResult[],
) {
  for (const expected of scenario.expected.expectedRejectedRules || []) {
    const card = result.evaluatedCards.find((item) => item.card.slug === expected.cardSlug);
    const rejected = card?.trace.find(
      (trace) => trace.benefitId === expected.benefitId && !trace.applicable,
    );
    const expectedReasons = REJECTION_MAP[expected.reason] || [];
    const passed =
      Boolean(rejected) &&
      (!expectedReasons.length ||
        expectedReasons.some((reason) =>
          rejected!.rejectionReasons.some((actual) =>
            actual.toLowerCase().includes(reason.toLowerCase()),
          ),
        ));
    push(assertions, `rejected rule ${expected.cardSlug}:${expected.benefitId}`, {
      expected,
      actual: rejected?.rejectionReasons,
      passed,
    });
  }
}

function push(
  assertions: ScenarioAssertionResult[],
  name: string,
  input: { passed: boolean; expected?: unknown; actual?: unknown; message?: string },
) {
  assertions.push({ name, ...input });
}
