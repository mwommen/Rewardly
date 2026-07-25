import type { ScenarioCatalog, RecommendationScenario, ScenarioAssertionResult } from "./recommendationScenario.types";
import type { DecisionPolicies } from "../services/walletDecisionEngine";
import { runRecommendationScenario } from "./recommendationScenarioRunner";

export function assertRecommendationInvariants(
  scenarios: RecommendationScenario[],
  catalog: ScenarioCatalog,
  options: { policies?: DecisionPolicies } = {},
): ScenarioAssertionResult[] {
  const assertions: ScenarioAssertionResult[] = [];
  scenarios.forEach((scenario) => {
    const first = runRecommendationScenario(scenario, catalog, options);
    const second = runRecommendationScenario(structuredCloneScenario(scenario), catalog, options);
    const walletSlugs = new Set(scenario.wallet.cards.map((card) => card.cardSlug));
    const reordered = runRecommendationScenario(
      {
        ...structuredCloneScenario(scenario),
        id: `${scenario.id}-reordered`,
        wallet: {
          ...scenario.wallet,
          cards: [...scenario.wallet.cards].reverse(),
        },
      },
      catalog,
      options,
    );
    assertions.push({
      name: `${scenario.id}: wallet-only invariant`,
      passed:
        first.decisionTrace.evaluatedCards.every((card) => walletSlugs.has(card.card.slug)) &&
        (!first.actual.winnerCardSlug || walletSlugs.has(first.actual.winnerCardSlug)),
      expected: Array.from(walletSlugs),
      actual: first.decisionTrace.evaluatedCards.map((card) => card.card.slug),
    });
    assertions.push({
      name: `${scenario.id}: determinism invariant`,
      passed:
        JSON.stringify(normalizedDecisionSummary(first)) ===
        JSON.stringify(normalizedDecisionSummary(second)),
      expected: normalizedDecisionSummary(first),
      actual: normalizedDecisionSummary(second),
    });
    assertions.push({
      name: `${scenario.id}: wallet order independence invariant`,
      passed:
        first.actual.winnerCardSlug === reordered.actual.winnerCardSlug &&
        first.actual.winnerBenefitId === reordered.actual.winnerBenefitId &&
        first.actual.cashEquivalent === reordered.actual.cashEquivalent &&
        first.actual.confidenceScore === reordered.actual.confidenceScore,
      expected: normalizedDecisionSummary(first),
      actual: normalizedDecisionSummary(reordered),
    });
    assertions.push({
      name: `${scenario.id}: explanation invariant`,
      passed:
        !first.decisionTrace.winningRule ||
        first.decisionTrace.explanation.includes(first.decisionTrace.winningCard?.card.name || ""),
      expected: first.decisionTrace.winningCard?.card.name,
      actual: first.decisionTrace.explanation,
    });
    assertions.push({
      name: `${scenario.id}: winning rule belongs to winning card invariant`,
      passed:
        !first.decisionTrace.winningRule ||
        first.decisionTrace.winningRule.cardSlug === first.actual.winnerCardSlug,
      expected: first.actual.winnerCardSlug,
      actual: first.decisionTrace.winningRule?.cardSlug,
    });
    assertions.push({
      name: `${scenario.id}: runner-up differs from winner invariant`,
      passed:
        !first.actual.runnerUpCardSlug ||
        first.actual.runnerUpCardSlug !== first.actual.winnerCardSlug,
      expected: "runner-up differs",
      actual: first.actual.runnerUpCardSlug,
    });
    assertions.push({
      name: `${scenario.id}: finite nonnegative reward invariant`,
      passed:
        first.actual.cashEquivalent === undefined ||
        (Number.isFinite(first.actual.cashEquivalent) && first.actual.cashEquivalent >= 0),
      expected: "finite nonnegative value",
      actual: first.actual.cashEquivalent,
    });
    assertions.push({
      name: `${scenario.id}: confidence range invariant`,
      passed:
        first.actual.confidenceScore === undefined ||
        (Number.isFinite(first.actual.confidenceScore) &&
          first.actual.confidenceScore >= 0 &&
          first.actual.confidenceScore <= 1),
      expected: "0..1",
      actual: first.actual.confidenceScore,
    });
    assertions.push({
      name: `${scenario.id}: audit log winner aligns invariant`,
      passed:
        !first.decisionTrace.winningRule ||
        first.decisionTrace.auditLog.winningRule === first.decisionTrace.winningRule.ruleId,
      expected: first.decisionTrace.winningRule?.ruleId,
      actual: first.decisionTrace.auditLog.winningRule,
    });
    assertions.push({
      name: `${scenario.id}: no rejected rule is winning rule invariant`,
      passed:
        !first.decisionTrace.winningRule ||
        !first.decisionTrace.auditLog.rejectedRules.some(
          (rule) => rule.ruleId === first.decisionTrace.winningRule?.ruleId,
        ),
      expected: "winning rule not rejected",
      actual: first.decisionTrace.winningRule?.ruleId,
    });
    if (scenario.classification.source !== "unknown") {
      const lowerConfidence = {
        ...structuredCloneScenario(scenario),
        classification: {
          ...scenario.classification,
          confidence: Math.max(0.1, scenario.classification.confidence - 0.3),
          source: "inferred" as const,
          isVerified: false,
        },
      };
      const degraded = runRecommendationScenario(lowerConfidence, catalog, options);
      assertions.push({
        name: `${scenario.id}: confidence invariant`,
        passed:
          (degraded.actual.confidenceScore || 0) <= (first.actual.confidenceScore || 0),
        expected: `<= ${first.actual.confidenceScore}`,
        actual: degraded.actual.confidenceScore,
      });
    }
  });
  return assertions;
}

function normalizedDecisionSummary(result: ReturnType<typeof runRecommendationScenario>) {
  return {
    winnerCardSlug: result.actual.winnerCardSlug,
    winnerBenefitId: result.actual.winnerBenefitId,
    runnerUpCardSlug: result.actual.runnerUpCardSlug,
    runnerUpBenefitId: result.actual.runnerUpBenefitId,
    cashEquivalent: result.actual.cashEquivalent,
    confidenceScore: result.actual.confidenceScore,
    confidenceLevel: result.actual.confidenceLevel,
  };
}

function structuredCloneScenario(scenario: RecommendationScenario): RecommendationScenario {
  return JSON.parse(JSON.stringify(scenario)) as RecommendationScenario;
}
