import type {
  RecommendationFailureCategory,
  ScenarioAssertionResult,
} from "./recommendationScenario.types";

const CATEGORY_BY_ASSERTION: Array<[RegExp, RecommendationFailureCategory]> = [
  [/wallet|unowned/i, "wallet_integrity"],
  [/winner card/i, "wrong_winner"],
  [/runner-up card/i, "wrong_runner_up"],
  [/benefit/i, "wrong_benefit"],
  [/rule type|precedence/i, "wrong_rule_precedence"],
  [/reward quantity|cash-equivalent|credit|cap/i, "reward_calculation"],
  [/valuation/i, "valuation"],
  [/classification/i, "classification"],
  [/confidence/i, "confidence"],
  [/wallet state/i, "wallet_state"],
  [/enrollment/i, "enrollment_handling"],
  [/activation/i, "activation_handling"],
  [/expired|effective|date/i, "date_handling"],
  [/explanation|fallback/i, "explanation"],
  [/audit|decision id|timestamp|version|source/i, "audit_trace"],
];

export function classifyRecommendationFailures(
  assertions: ScenarioAssertionResult[],
): RecommendationFailureCategory[] {
  const categories = new Set<RecommendationFailureCategory>();
  assertions
    .filter((assertion) => !assertion.passed)
    .forEach((assertion) => {
      const text = `${assertion.name} ${assertion.message || ""}`;
      const match = CATEGORY_BY_ASSERTION.find(([pattern]) => pattern.test(text));
      categories.add(match?.[1] || "scenario_definition");
    });
  return Array.from(categories);
}
