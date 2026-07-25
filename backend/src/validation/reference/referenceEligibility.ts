import type { RecommendationScenario } from "../recommendationScenario.types";
import type { ReferenceBenefit } from "./referenceBenefit.types";
import { normalize, normalizeCategory } from "./referenceFixtureAdapter";

export function referenceRejectionReasons(
  benefit: ReferenceBenefit,
  scenario: RecommendationScenario,
) {
  const reasons: string[] = [];
  const date = new Date(scenario.purchase.transactionDate);
  if (benefit.effectiveDate && new Date(benefit.effectiveDate) > date) reasons.push("not_yet_effective");
  if (benefit.expirationDate && new Date(benefit.expirationDate) < date) reasons.push("expired");
  if (!channelMatches(benefit, scenario)) reasons.push("channel_mismatch");
  if (!purchaseMatches(benefit, scenario)) reasons.push("category_mismatch");

  const state = scenario.walletBenefitStates?.find(
    (item: any) => item.cardSlug === benefit.cardSlug && item.benefitId === benefit.id,
  ) as any;
  if (benefit.enrollmentRequired) {
    if (!state || state.enrollmentStatus === "unknown") reasons.push("wallet_state_missing");
    else if (state.enrollmentStatus !== "enrolled") reasons.push("enrollment_required");
  }
  if (benefit.activationRequired) {
    if (!state || state.activationStatus === "unknown") reasons.push("wallet_state_missing");
    else if (state.activationStatus !== "activated") reasons.push("activation_required");
  }
  if (benefit.capAmountUSD !== null) {
    if (!state || typeof state.remainingSpendCap !== "number") reasons.push("wallet_state_missing");
    else if (state.remainingSpendCap <= 0) reasons.push("cap_exhausted");
  }
  if (benefit.creditAmountUSD !== null) {
    if (!state || typeof state.remainingValue !== "number") reasons.push("wallet_state_missing");
    else if (state.remainingValue <= 0) reasons.push("credit_exhausted");
  }
  return Array.from(new Set(reasons));
}

export function purchaseMatches(benefit: ReferenceBenefit, scenario: RecommendationScenario) {
  if (benefit.ruleType === "base") return true;
  const merchant = normalize(scenario.purchase.normalizedMerchant || scenario.purchase.merchantName);
  if (benefit.merchants.length) {
    return benefit.merchants.some((restriction) => merchant.includes(restriction));
  }
  if (scenario.classification.source === "unknown") return false;
  if (scenario.purchase.channel === "issuer_portal") {
    return benefit.ruleType === "portal" || benefit.categories.includes("travel");
  }
  const category = normalizeCategory(scenario.classification.category);
  return categoryAliases(category).some((alias) => benefit.categories.includes(alias));
}

function channelMatches(benefit: ReferenceBenefit, scenario: RecommendationScenario) {
  return benefit.channels.includes("any") || benefit.channels.includes(scenario.purchase.channel);
}

function categoryAliases(value: string) {
  const aliases: Record<string, string[]> = {
    grocery: ["grocery", "groceries", "supermarket"],
    drugstore: ["drugstore", "drugstores", "pharmacy"],
    dining: ["dining", "restaurant", "restaurants"],
    gas: ["gas", "fuel"],
    travel: ["travel", "airfare", "hotel"],
    general_retail: ["general_retail", "online_retail"],
    online_retail: ["online_retail", "general_retail"],
  };
  return aliases[value] || [value];
}
