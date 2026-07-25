import type { RecommendationScenario, ScenarioCatalog } from "../recommendationScenario.types";
import { adaptCatalogToReference } from "./referenceFixtureAdapter";
import { referenceRejectionReasons } from "./referenceEligibility";
import { rankReferenceCandidates } from "./referenceRanking";
import { referenceRound, referenceValuePerUnit } from "./referenceValuation";
import type { ReferenceCandidate, ReferenceEvaluation } from "./referenceBenefit.types";

export function evaluateScenarioWithIndependentReference(
  scenario: RecommendationScenario,
  catalog: ScenarioCatalog,
): ReferenceEvaluation {
  const referenceCatalog = adaptCatalogToReference(catalog);
  const candidates: ReferenceCandidate[] = scenario.wallet.cards.flatMap((walletCard) => {
    const card = referenceCatalog[walletCard.cardSlug];
    if (!card) return [];
    return card.benefits.map((benefit): ReferenceCandidate => {
      const rejectionReasons = referenceRejectionReasons(benefit, scenario);
      const estimate = estimateReferenceBenefit(benefit, scenario);
      const hasValue = estimate.rawValueUSD > 0;
      return {
        cardSlug: card.slug,
        cardName: card.name,
        benefitId: benefit.id,
        ruleType: ruleTypeForContext(benefit.ruleType, scenario),
        estimatedValueUSD: estimate.valueUSD,
        rewardQuantity: estimate.quantity,
        confidence: benefit.confidence,
        precedence: benefit.precedence,
        rejectionReasons: hasValue ? rejectionReasons : [...rejectionReasons, "no_value"],
      };
    });
  });
  const eligible = rankReferenceCandidates(
    candidates.filter((candidate) => candidate.rejectionReasons.length === 0),
  );
  const winner = eligible[0];
  if (!winner) throw new Error(`Reference evaluator found no eligible rule for ${scenario.id}`);
  const runnerUp = eligible[1];
  return {
    winnerCardSlug: winner.cardSlug,
    winnerBenefitId: winner.benefitId,
    winnerRuleType: winner.ruleType,
    runnerUpCardSlug: runnerUp?.cardSlug,
    runnerUpBenefitId: runnerUp?.benefitId,
    expectedValueUSD: winner.estimatedValueUSD,
    reason: `${winner.cardName} has the highest independently evaluated eligible value.`,
    candidates,
  };
}

function estimateReferenceBenefit(benefit: any, scenario: RecommendationScenario) {
  const amount = scenario.purchase.amount;
  const state = scenario.walletBenefitStates?.find(
    (item: any) => item.cardSlug === benefit.cardSlug && item.benefitId === benefit.id,
  ) as any;
  if (benefit.creditAmountUSD !== null) {
    const remaining = typeof state?.remainingValue === "number" ? state.remainingValue : benefit.creditAmountUSD;
    const value = Math.max(0, Math.min(amount, remaining, benefit.creditAmountUSD));
    return { quantity: referenceRound(value, 2), valueUSD: referenceRound(value, 2), rawValueUSD: value };
  }
  const eligibleAmount =
    benefit.capAmountUSD !== null && typeof state?.remainingSpendCap === "number"
      ? Math.min(amount, Math.max(0, state.remainingSpendCap))
      : amount;
  if (eligibleAmount <= 0) return { quantity: 0, valueUSD: 0, rawValueUSD: 0 };
  if (benefit.rateUnit === "percent") {
    const cash = eligibleAmount * (benefit.rate / 100);
    return { quantity: cash, valueUSD: referenceRound(cash, 2), rawValueUSD: cash };
  }
  const quantity = eligibleAmount * benefit.rate;
  return {
    quantity,
    valueUSD: referenceRound(quantity * referenceValuePerUnit(benefit), 2),
    rawValueUSD: quantity * referenceValuePerUnit(benefit),
  };
}

function ruleTypeForContext(ruleType: any, scenario: RecommendationScenario) {
  if (ruleType === "category" && scenario.purchase.channel === "issuer_portal") return "portal";
  return ruleType;
}
