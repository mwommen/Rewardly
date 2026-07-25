import type {
  Card,
  Merchant,
  RecommendationPurchaseContext,
} from "../../../packages/rewardly-core/src";
import { toCashEquivalent } from "../utils/valuation";
import {
  type CanonicalBenefitRecord,
  type PurchaseChannel,
} from "./benefitIntelligenceService";
import { isBenefitEligibleForRecommendation } from "./benefitEligibilityService";
import {
  benefitRulePrecedenceWeight,
  calculateBenefitDecisionConfidence,
  createDecisionAuditLog,
  loadBenefitRegistry,
  type BenefitRegistryDecisionAuditLog,
  type BenefitRegistryRule,
} from "./benefitRegistryService";
import {
  applyWalletUsageToBenefitValue,
  type CanonicalWalletBenefitState,
} from "./walletIntelligenceService";

export type WalletDecisionPurchase = {
  merchant: Pick<Merchant, "name" | "category" | "mcc">;
  amount?: number | null;
  category?: string | null;
  purchaseChannel?: PurchaseChannel;
  recommendationPurchaseContext?: RecommendationPurchaseContext | null;
  classification?: {
    category: string | null;
    confidence: number;
    source: "merchant_registry" | "purchase_intelligence" | "mcc" | "inferred" | "unknown";
    evidence: string[];
  };
};

export type WalletDecisionWinningRule = {
  ruleId: string;
  benefitId: string;
  cardSlug: string;
  cardName: string;
  label: string;
  sourceKind: CanonicalBenefitRecord["sourceKind"];
  rewardProgram: string;
  rewardType: CanonicalBenefitRecord["rewardMechanism"];
  earningRate: number | null;
  earningUnit:
    | "points_per_dollar"
    | "miles_per_dollar"
    | "percent_back"
    | "flat_credit"
    | "unknown";
  applicableCategories: string[];
  merchantRestrictions: string[];
  enrollmentRequired: boolean;
  activationRequired: boolean;
  annualCap: number | null;
  remainingCap: number | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  estimatedRewardQuantity: number | null;
  estimatedValueUSD: number;
  confidence: number;
  confidenceFactors: {
    merchantClassificationConfidence: number;
    benefitConfidence: number;
    walletStateConfidence: number;
    dataFreshness: number;
  };
  valuation: RewardValuation;
};

export type RewardValuation = {
  source: "cash" | "rewardly_default_valuation";
  rewardCurrency: "cash" | "points" | "miles" | "statement_credit" | "unknown";
  valuePerUnitUSD: number | null;
  explanation: string;
};

export type WalletDecisionRuleTrace = {
  ruleId: string;
  benefitId: string;
  label: string;
  sourceKind: CanonicalBenefitRecord["sourceKind"];
  applicable: boolean;
  rejectionReasons: string[];
  earningRate: number | null;
  estimatedRewardQuantity: number | null;
  estimatedCashEquivalentValue: number;
  confidence: number;
  confidenceFactors: {
    merchantClassificationConfidence: number;
    benefitConfidence: number;
    walletStateConfidence: number;
    dataFreshness: number;
  };
  walletStateEffect: string;
  valuation: RewardValuation;
};

export type WalletDecisionCardScore = {
  card: Pick<Card, "slug" | "name" | "issuer" | "annualFee">;
  winningRule: WalletDecisionWinningRule | null;
  estimatedValueUSD: number;
  confidence: number;
  applicableRule: WalletDecisionWinningRule | null;
  rejectedRules: WalletDecisionRuleTrace[];
  trace: WalletDecisionRuleTrace[];
};

export type WalletDecisionResult = {
  winningCard: WalletDecisionCardScore | null;
  runnerUp: WalletDecisionCardScore | null;
  winningRule: WalletDecisionWinningRule | null;
  estimatedReward: {
    quantity: number | null;
    valueUSD: number;
    display: string;
  } | null;
  confidence: {
    score: number;
    label: "high" | "medium" | "low" | "unknown";
  };
  explanation: string;
  evaluatedCards: WalletDecisionCardScore[];
  comparison:
    | {
        mode: "direct_earning_rate";
        explanation: string;
      }
    | {
        mode: "estimated_cash_equivalent";
        explanation: string;
        valuations: RewardValuation[];
      };
  classification: {
    category: string | null;
    confidence: number;
    source: string;
    evidence: string[];
    verified: boolean;
  };
  auditLog: BenefitRegistryDecisionAuditLog;
};

type WalletUsageAdjustment = ReturnType<typeof applyWalletUsageToBenefitValue>;
type BenefitEligibilityResult = ReturnType<typeof isBenefitEligibleForRecommendation>;
type EstimatedBenefitValue = ReturnType<typeof estimateBenefitValue>;

export type DecisionPolicies = {
  selectCandidateCards: (walletCards: Card[], input: {
    wallet: { cards: Card[]; cardSlugs?: string[] };
    purchase: WalletDecisionPurchase;
  }) => Card[];
  adjustWalletUsage: (
    benefit: BenefitRegistryRule,
    walletBenefitStates: CanonicalWalletBenefitState[],
  ) => WalletUsageAdjustment;
  evaluateEligibility: (
    benefit: BenefitRegistryRule,
    context: Parameters<typeof isBenefitEligibleForRecommendation>[1],
  ) => BenefitEligibilityResult;
  estimateBenefitValue: (
    benefit: CanonicalBenefitRecord,
    card: Card,
    purchase: WalletDecisionPurchase,
    walletState?: CanonicalWalletBenefitState | null,
  ) => EstimatedBenefitValue;
  compareRules: (
    a: WalletDecisionWinningRule,
    b: WalletDecisionWinningRule,
  ) => number;
  compareCardScores: (
    a: WalletDecisionCardScore,
    b: WalletDecisionCardScore,
  ) => number;
  buildExplanation: (input: {
    winner: WalletDecisionCardScore | null;
    runnerUp: WalletDecisionCardScore | null;
    purchase: WalletDecisionPurchase;
  }) => string;
};

export const defaultDecisionPolicies: DecisionPolicies = {
  selectCandidateCards: (walletCards) => walletCards,
  adjustWalletUsage: (benefit, walletBenefitStates) =>
    applyWalletUsageToBenefitValue(benefit, walletBenefitStates, {
      statePolicy: "strict_production",
    }),
  evaluateEligibility: (benefit, context) =>
    isBenefitEligibleForRecommendation(benefit, context),
  estimateBenefitValue,
  compareRules,
  compareCardScores,
  buildExplanation: explanationFor,
};

export function evaluateWalletDecision(input: {
  wallet: { cards: Card[]; cardSlugs?: string[] };
  purchase: WalletDecisionPurchase;
  walletBenefitStates?: CanonicalWalletBenefitState[];
  now?: Date;
  policies?: DecisionPolicies;
}): WalletDecisionResult {
  const policies = input.policies || defaultDecisionPolicies;
  const walletCards = dedupeWalletCards(input.wallet.cards || []);
  if (!walletCards.length) {
    return emptyDecision("Add cards to your wallet to get personalized recommendations.");
  }
  const candidateCards = dedupeWalletCards(
    policies.selectCandidateCards(walletCards, {
      wallet: input.wallet,
      purchase: input.purchase,
    }),
  );

  const benefitRegistry = loadBenefitRegistry({
    cards: candidateCards,
    now: input.now || new Date(),
  });
  const cardScores = candidateCards
    .map((card) =>
      scoreWalletCard({
        card,
        benefitRules: benefitRegistry.rules.filter(
          (rule) => rule.cardSlug === card.slug,
        ),
        purchase: input.purchase,
        walletBenefitStates: input.walletBenefitStates || [],
        now: input.now || new Date(),
        policies,
      }),
    )
    .sort(policies.compareCardScores);

  const winningCard = cardScores[0] || null;
  const runnerUp = cardScores[1] || null;
  const winningRule = winningCard?.winningRule || null;
  const classification = classificationFor(input.purchase);
  const confidence = confidenceFor(winningRule);
  const auditLog = createDecisionAuditLog({
    merchant: input.purchase.merchant.name,
    classification,
    evaluatedCards: cardScores.map((cardScore) => ({
      card: {
        slug: cardScore.card.slug,
        name: cardScore.card.name,
      },
      trace: cardScore.trace,
    })),
    winningRuleId: winningRule?.ruleId || null,
    confidence,
    timestamp: (input.now || new Date()).toISOString(),
  });

  return {
    winningCard,
    runnerUp,
    winningRule,
    estimatedReward: winningRule
      ? {
          quantity: winningRule.estimatedRewardQuantity,
          valueUSD: round(winningRule.estimatedValueUSD, 2),
          display: estimatedRewardDisplay(winningRule, input.purchase.amount),
        }
      : null,
    confidence,
    explanation: policies.buildExplanation({
      winner: winningCard,
      runnerUp,
      purchase: input.purchase,
    }),
    evaluatedCards: cardScores,
    comparison: comparisonFor(cardScores),
    classification,
    auditLog,
  };
}

function scoreWalletCard(input: {
  card: Card;
  benefitRules: BenefitRegistryRule[];
  purchase: WalletDecisionPurchase;
  walletBenefitStates: CanonicalWalletBenefitState[];
  now: Date;
  policies: DecisionPolicies;
}): WalletDecisionCardScore {
  const trace = input.benefitRules.map(
    (benefit) =>
      evaluateBenefitRule({
        benefit,
        card: input.card,
        purchase: input.purchase,
        walletBenefitStates: input.walletBenefitStates,
        now: input.now,
        policies: input.policies,
      }),
  );
  const rules = trace
    .map((item) => item.rule)
    .filter((rule): rule is WalletDecisionWinningRule => Boolean(rule))
    .sort(input.policies.compareRules);

  const winningRule = rules[0] || null;
  const rejectedRules = trace
    .map((item) => item.trace)
    .filter((item) => !item.applicable);
  return {
    card: {
      slug: input.card.slug,
      name: input.card.name,
      issuer: input.card.issuer,
      annualFee: input.card.annualFee,
    },
    winningRule,
    applicableRule: winningRule,
    rejectedRules,
    trace: trace.map((item) => item.trace),
    estimatedValueUSD: winningRule?.estimatedValueUSD || 0,
    confidence: winningRule?.confidence || 0,
  };
}

function evaluateBenefitRule(input: {
  benefit: BenefitRegistryRule;
  card: Card;
  purchase: WalletDecisionPurchase;
  walletBenefitStates: CanonicalWalletBenefitState[];
  now: Date;
  policies: DecisionPolicies;
}): { rule: WalletDecisionWinningRule | null; trace: WalletDecisionRuleTrace } {
  const rejectionReasons: string[] = [];
  const walletAdjusted = input.policies.adjustWalletUsage(
    input.benefit,
    input.walletBenefitStates,
  );
  if (!walletAdjusted.walletDecision.eligible) {
    rejectionReasons.push(walletAdjusted.walletDecision.reason);
  }

  const benefit = walletAdjusted.benefit as BenefitRegistryRule;
  const categories = purchaseCategories(input.purchase);
  const merchantText = normalize(input.purchase.merchant.name);
  const purchaseChannel = input.purchase.purchaseChannel || "online";
  const matchingCategory = matchingCategoryForBenefit(benefit, categories);

  const eligibility = input.policies.evaluateEligibility(benefit, {
    now: input.now,
    merchant: input.purchase.merchant.name,
    merchantCategory:
      benefit.sourceKind === "reward_flat" ? undefined : matchingCategory,
    purchaseChannel,
    productionOnly: true,
    enrolledBenefitIds: enrolledBenefitIds(input.walletBenefitStates),
    activatedBenefitIds: activatedBenefitIds(input.walletBenefitStates),
    knownEnrollmentBenefitIds: knownEnrollmentBenefitIds(input.walletBenefitStates),
    knownActivationBenefitIds: knownActivationBenefitIds(input.walletBenefitStates),
  });
  if (!eligibility.eligible) rejectionReasons.push(eligibility.reasonCode);

  if (!benefitMatchesPurchase(benefit, categories, merchantText)) {
    rejectionReasons.push("RULE_DOES_NOT_MATCH_PURCHASE");
  }

  const estimated = input.policies.estimateBenefitValue(
    benefit,
    input.card,
    input.purchase,
    walletAdjusted.walletDecision.state,
  );
  if (estimated.valueUSD <= 0) rejectionReasons.push("RULE_HAS_NO_ESTIMATED_VALUE");

  const valuation = valuationFor(benefit, input.card);
  const confidence = ruleConfidence(
    benefit,
    input.purchase,
    walletAdjusted.walletDecision.confidence,
    input.now,
  );
  const baseTrace = {
    ruleId: benefit.registryRuleId,
    benefitId: benefit.id,
    label: benefit.label,
    sourceKind: benefit.sourceKind,
    applicable: rejectionReasons.length === 0,
    rejectionReasons,
    earningRate: benefitMultiplier(benefit),
    estimatedRewardQuantity: estimated.quantity,
    estimatedCashEquivalentValue: round(estimated.valueUSD, 2),
    confidence: confidence.score,
    confidenceFactors: confidence.factors,
    walletStateEffect: walletAdjusted.walletDecision.explanation,
    valuation,
  };

  if (rejectionReasons.length) return { rule: null, trace: baseTrace };

  const rule: WalletDecisionWinningRule = {
      ruleId: baseTrace.ruleId,
      benefitId: benefit.id,
      cardSlug: input.card.slug,
      cardName: input.card.name,
      label: benefit.label,
      sourceKind: benefit.sourceKind,
      rewardProgram: rewardProgramFor(input.card, benefit),
      rewardType: benefit.rewardMechanism,
      earningRate: benefitMultiplier(benefit),
      earningUnit: earningUnitFor(benefit),
      applicableCategories: benefit.sourceKind === "reward_flat" ? ["all purchases"] : categories,
      merchantRestrictions: [
        benefit.specificMerchant,
        ...benefit.specificMerchantIds,
      ].filter(Boolean) as string[],
      enrollmentRequired: benefit.enrollmentRequired,
      activationRequired: benefit.activationRequired,
      annualCap: benefit.annualCredits ?? benefit.spendingCap?.amountUSD ?? null,
      remainingCap:
        walletAdjusted.walletDecision.remainingValue ??
        walletAdjusted.walletDecision.state?.remainingSpendCap ??
        null,
      effectiveDate: benefit.effectiveDate,
      expirationDate: benefit.expirationDate,
      estimatedRewardQuantity: estimated.quantity,
      estimatedValueUSD: round(estimated.valueUSD, 2),
      confidence: confidence.score,
      confidenceFactors: confidence.factors,
      valuation,
  };
  return { rule, trace: baseTrace };
}

function benefitMatchesPurchase(
  benefit: CanonicalBenefitRecord,
  categories: string[],
  merchantText: string,
) {
  if (benefit.sourceKind === "reward_flat") return true;
  if (benefit.specificMerchant || benefit.specificMerchantIds.length) {
    const restrictions = [
      benefit.specificMerchant,
      ...benefit.specificMerchantIds,
    ].map(normalize);
    return restrictions.some(
      (restriction) =>
        restriction &&
        (merchantText.includes(restriction) || restriction.includes(merchantText)),
    );
  }
  if (benefit.merchantCategory) {
    return categories.includes(normalizeCategory(benefit.merchantCategory));
  }
  return false;
}

function matchingCategoryForBenefit(
  benefit: CanonicalBenefitRecord,
  categories: string[],
) {
  if (!benefit.merchantCategory) return categories[0] || "other";
  const normalized = normalizeCategory(benefit.merchantCategory);
  return categories.includes(normalized) ? benefit.merchantCategory : categories[0] || "other";
}

function estimateBenefitValue(
  benefit: CanonicalBenefitRecord,
  card: Card,
  purchase: WalletDecisionPurchase,
  walletState?: CanonicalWalletBenefitState | null,
) {
  const amount = Number.isFinite(purchase.amount) ? Number(purchase.amount) : 0;
  if (
    (benefit.sourceKind === "merchant_credit" ||
      benefit.sourceKind === "recurring_credit") &&
    benefit.statementCredit?.amountUSD
  ) {
    const credit = benefit.statementCredit.amountUSD;
    return {
      quantity: credit,
      valueUSD: amount > 0 ? Math.min(credit, amount) : credit,
    };
  }

  const multiplier = benefitMultiplier(benefit);
  if (!multiplier) return { quantity: null, valueUSD: 0 };
  const eligibleAmount =
    amount > 0 && typeof walletState?.remainingSpendCap === "number"
      ? Math.min(amount, Math.max(0, walletState.remainingSpendCap))
      : amount;
  if (amount > 0 && eligibleAmount <= 0) return { quantity: null, valueUSD: 0 };
  if (benefit.rewardMechanism === "cash_back") {
    const cashBack = amount > 0 ? eligibleAmount * (multiplier / 100) : multiplier / 100;
    return { quantity: cashBack, valueUSD: cashBack };
  }
  if (benefit.rewardMechanism === "points" || benefit.rewardMechanism === "miles") {
    const quantity = amount > 0 ? eligibleAmount * multiplier : null;
    return {
      quantity,
      valueUSD: amount > 0
        ? eligibleAmount * toCashEquivalent(benefit.rewardMechanism, multiplier, issuerValuationKey(card))
        : toCashEquivalent(benefit.rewardMechanism, multiplier, issuerValuationKey(card)),
    };
  }
  return { quantity: null, valueUSD: 0 };
}

function explanationFor(input: {
  winner: WalletDecisionCardScore | null;
  runnerUp: WalletDecisionCardScore | null;
  purchase: WalletDecisionPurchase;
}) {
  if (!input.winner?.winningRule) {
    return "Rewardly could not find a verified earning rule in this wallet for this purchase.";
  }
  const rule = input.winner.winningRule;
  const merchant = input.purchase.merchant.name || "this merchant";
  const category = displayCategory(input.purchase);
  const classification = classificationFor(input.purchase);
  const lines = [
    classification.verified
      ? `Merchant classified as ${readableCategory(category)}.`
      : `Merchant appears to be ${readableCategory(category)} based on ${classification.source}.`,
    `${input.winner.card.name} earns ${ruleLabel(rule)}.`,
  ];
  if (input.runnerUp?.winningRule) {
    lines.push(
      `${input.runnerUp.card.name} earns ${ruleLabel(input.runnerUp.winningRule)}.`,
    );
  }
  lines.push(
    `${input.winner.card.name} provides the highest verified reward for ${merchant}.`,
  );
  return lines.join(" ");
}

function displayCategory(purchase: WalletDecisionPurchase) {
  return (
    purchase.category ||
    purchase.recommendationPurchaseContext?.dominantCategory ||
    purchase.merchant.category ||
    "this purchase"
  );
}

function purchaseCategories(purchase: WalletDecisionPurchase) {
  const raw = [
    purchase.category,
    purchase.recommendationPurchaseContext?.dominantCategory,
    purchase.merchant.category,
    purchase.merchant.mcc,
    "other",
  ].filter(Boolean) as string[];
  return Array.from(new Set(raw.flatMap((item) => categoryAliases(item))));
}

function categoryAliases(value: string) {
  const normalized = normalizeCategory(value);
  const aliases: Record<string, string[]> = {
    restaurant: ["restaurant", "restaurants", "dining"],
    restaurants: ["restaurant", "restaurants", "dining"],
    dining: ["restaurant", "restaurants", "dining"],
    grocery: ["grocery", "groceries", "supermarket"],
    groceries: ["grocery", "groceries", "supermarket"],
    gas: ["gas", "fuel"],
    fuel: ["gas", "fuel"],
    drugstore: ["drugstore", "drugstores", "pharmacy"],
    drugstores: ["drugstore", "drugstores", "pharmacy"],
    pharmacy: ["drugstore", "drugstores", "pharmacy"],
    streaming: ["streaming", "subscription"],
    travel: ["travel", "airfare", "hotel", "hotels"],
    travel_portal: ["travel_portal", "issuer_travel_portal", "travel"],
    issuer_travel_portal: ["travel_portal", "issuer_travel_portal", "travel"],
    electronics: ["electronics", "online_shopping", "technology_purchase"],
    general_retail: ["general_retail", "online_shopping", "other"],
    online_shopping: ["general_retail", "online_shopping", "other"],
    unknown: ["unknown", "other"],
  };
  return aliases[normalized] || [normalized];
}

function comparisonFor(cardScores: WalletDecisionCardScore[]): WalletDecisionResult["comparison"] {
  const winningRules = cardScores
    .map((score) => score.winningRule)
    .filter((rule): rule is WalletDecisionWinningRule => Boolean(rule));
  const valuationKeys = new Set(
    winningRules.map((rule) => `${rule.earningUnit}:${rule.rewardProgram}`),
  );
  if (valuationKeys.size <= 1) {
    return {
      mode: "direct_earning_rate",
      explanation:
        "Owned cards use the same reward currency for this decision, so Rewardly compared earning rates directly.",
    };
  }
  return {
    mode: "estimated_cash_equivalent",
    explanation:
      "Owned cards use different reward currencies, so Rewardly converted each rule into an estimated cash-equivalent value before choosing a winner.",
    valuations: dedupeValuations(winningRules.map((rule) => rule.valuation)),
  };
}

function dedupeValuations(valuations: RewardValuation[]) {
  const byKey = new Map<string, RewardValuation>();
  valuations.forEach((valuation) => {
    byKey.set(`${valuation.rewardCurrency}:${valuation.valuePerUnitUSD}`, valuation);
  });
  return Array.from(byKey.values());
}

function classificationFor(purchase: WalletDecisionPurchase): WalletDecisionResult["classification"] {
  const classification = purchase.classification;
  const category =
    classification?.category ||
    purchase.category ||
    purchase.recommendationPurchaseContext?.dominantCategory ||
    purchase.merchant.category ||
    null;
  const confidence =
    classification?.confidence ??
    purchase.recommendationPurchaseContext?.confidenceScore ??
    0.82;
  const source =
    classification?.source ||
    (purchase.recommendationPurchaseContext ? "purchase_intelligence" : "merchant_registry");
  return {
    category,
    confidence: round(confidence, 2),
    source,
    evidence: classification?.evidence || [],
    verified: confidence >= 0.8 && source !== "inferred" && source !== "unknown",
  };
}

function compareCardScores(a: WalletDecisionCardScore, b: WalletDecisionCardScore) {
  if (b.estimatedValueUSD !== a.estimatedValueUSD) {
    return b.estimatedValueUSD - a.estimatedValueUSD;
  }
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.card.name.localeCompare(b.card.name);
}

function compareRules(a: WalletDecisionWinningRule, b: WalletDecisionWinningRule) {
  const precedenceDelta =
    benefitRulePrecedenceWeight(precedenceForRule(b)) -
    benefitRulePrecedenceWeight(precedenceForRule(a));
  if (precedenceDelta !== 0) return precedenceDelta;
  if (b.estimatedValueUSD !== a.estimatedValueUSD) {
    return b.estimatedValueUSD - a.estimatedValueUSD;
  }
  if (sourceWeight(b.sourceKind) !== sourceWeight(a.sourceKind)) {
    return sourceWeight(b.sourceKind) - sourceWeight(a.sourceKind);
  }
  return b.confidence - a.confidence;
}

function precedenceForRule(rule: WalletDecisionWinningRule) {
  if (rule.merchantRestrictions.length) return "merchant_specific" as const;
  if (/portal|issuer_travel_portal|travel_portal/i.test(rule.applicableCategories.join(" "))) {
    return "portal_specific" as const;
  }
  if (rule.sourceKind === "reward_flat") return "base_earning" as const;
  return "category" as const;
}

function sourceWeight(sourceKind: CanonicalBenefitRecord["sourceKind"]) {
  if (sourceKind === "merchant_credit") return 4;
  if (sourceKind === "reward_category" || sourceKind === "reward_rotating") return 3;
  if (sourceKind === "reward_flat") return 2;
  return 1;
}

function confidenceFor(rule: WalletDecisionWinningRule | null) {
  if (!rule) return { score: 0, label: "unknown" as const };
  if (rule.confidence >= 0.85) return { score: rule.confidence, label: "high" as const };
  if (rule.confidence >= 0.7) return { score: rule.confidence, label: "medium" as const };
  return { score: rule.confidence, label: "low" as const };
}

function ruleConfidence(
  benefit: CanonicalBenefitRecord,
  purchase: WalletDecisionPurchase,
  walletStateConfidence: number,
  now: Date,
) {
  const merchantClassificationConfidence =
    purchase.classification?.confidence ??
    purchase.recommendationPurchaseContext?.confidenceScore ??
    0.82;
  return calculateBenefitDecisionConfidence({
    merchantClassificationConfidence,
    benefitConfidence: benefit.confidenceScore,
    walletStateConfidence,
    lastVerified: benefit.lastVerified,
    now,
  });
}

function estimatedRewardDisplay(
  rule: WalletDecisionWinningRule,
  amount?: number | null,
) {
  if (rule.earningUnit === "flat_credit") {
    return `$${rule.estimatedValueUSD.toFixed(2)} estimated statement credit`;
  }
  if (!amount || rule.estimatedRewardQuantity === null) {
    return `${ruleLabel(rule)}. Estimate updates when Rewardly can read the total.`;
  }
  return `${formatQuantity(rule.estimatedRewardQuantity, rule)} on $${amount.toFixed(2)}`;
}

function ruleLabel(rule: WalletDecisionWinningRule) {
  if (rule.earningUnit === "flat_credit") {
    return `$${(rule.earningRate || rule.estimatedValueUSD).toFixed(0)} statement credit`;
  }
  if (!rule.earningRate) return rule.label;
  const rate = Number.isInteger(rule.earningRate)
    ? rule.earningRate.toFixed(0)
    : rule.earningRate.toFixed(1);
  if (rule.earningUnit === "percent_back") return `${rate}% cash back`;
  return `${rate}x ${rule.rewardProgram}`;
}

function benefitMultiplier(benefit: CanonicalBenefitRecord) {
  if (typeof benefit.multiplier === "number" && Number.isFinite(benefit.multiplier)) {
    return benefit.multiplier;
  }
  const match = benefit.label.match(/([\d.]+)\s*(x|%)/i);
  return match ? Number(match[1]) : null;
}

function formatQuantity(quantity: number, rule: WalletDecisionWinningRule) {
  if (rule.earningUnit === "percent_back") return `$${quantity.toFixed(2)} cash back`;
  const rounded = Math.round(quantity).toLocaleString("en-US");
  return `${rounded} ${rule.rewardProgram}`;
}

function earningUnitFor(benefit: CanonicalBenefitRecord): WalletDecisionWinningRule["earningUnit"] {
  if (benefit.statementCredit) return "flat_credit";
  if (benefit.rewardMechanism === "cash_back") return "percent_back";
  if (benefit.rewardMechanism === "miles") return "miles_per_dollar";
  if (benefit.rewardMechanism === "points") return "points_per_dollar";
  return "unknown";
}

function rewardProgramFor(card: Card, benefit: CanonicalBenefitRecord) {
  if (benefit.rewardMechanism === "miles") {
    return /venture/i.test(card.name) ? "Venture Miles" : "miles";
  }
  if (benefit.rewardMechanism === "points") {
    return /amex|american express/i.test(card.issuer || card.name)
      ? "Membership Rewards"
      : /chase/i.test(card.issuer || card.name)
        ? "Ultimate Rewards"
        : "points";
  }
  if (benefit.rewardMechanism === "cash_back") return "cash back";
  return "statement credit";
}

function valuationFor(benefit: CanonicalBenefitRecord, card: Card): RewardValuation {
  if (benefit.statementCredit) {
    return {
      source: "cash",
      rewardCurrency: "statement_credit",
      valuePerUnitUSD: 1,
      explanation: "Statement credits are valued at face value when eligible and remaining.",
    };
  }
  if (benefit.rewardMechanism === "cash_back") {
    return {
      source: "cash",
      rewardCurrency: "cash",
      valuePerUnitUSD: 1,
      explanation: "Cash back is valued at face value.",
    };
  }
  if (benefit.rewardMechanism === "points" || benefit.rewardMechanism === "miles") {
    const valuePerPoint = toCashEquivalent(
      benefit.rewardMechanism,
      1,
      issuerValuationKey(card),
    );
    return {
      source: "rewardly_default_valuation",
      rewardCurrency: benefit.rewardMechanism,
      valuePerUnitUSD: valuePerPoint,
      explanation: `${rewardProgramFor(card, benefit)} valued at $${valuePerPoint.toFixed(3)} per point or mile for cross-currency comparison.`,
    };
  }
  return {
    source: "rewardly_default_valuation",
    rewardCurrency: "unknown",
    valuePerUnitUSD: null,
    explanation: "No explicit valuation is available for this reward currency.",
  };
}

function issuerValuationKey(card: Card) {
  const text = `${card.issuer || ""} ${card.name || ""}`.toLowerCase();
  if (/american express|amex/.test(text)) return "amex";
  if (/chase/.test(text)) return "chase";
  if (/citi/.test(text)) return "citi";
  if (/discover/.test(text)) return "discover";
  return card.issuer || "other";
}

function enrolledBenefitIds(states: CanonicalWalletBenefitState[]) {
  return states
    .filter((state) => state.enrollmentStatus === "enrolled")
    .map((state) => state.benefitId);
}

function knownEnrollmentBenefitIds(states: CanonicalWalletBenefitState[]) {
  return states
    .filter((state) => state.enrollmentStatus !== "unknown")
    .map((state) => state.benefitId);
}

function activatedBenefitIds(states: CanonicalWalletBenefitState[]) {
  return states
    .filter((state) => state.activationStatus === "activated")
    .map((state) => state.benefitId);
}

function knownActivationBenefitIds(states: CanonicalWalletBenefitState[]) {
  return states
    .filter((state) => state.activationStatus !== "unknown")
    .map((state) => state.benefitId);
}

function dedupeWalletCards(cards: Card[]) {
  const bySlug = new Map<string, Card>();
  cards.forEach((card) => {
    if (card?.slug && !bySlug.has(card.slug)) bySlug.set(card.slug, card);
  });
  return Array.from(bySlug.values());
}

function emptyDecision(explanation: string): WalletDecisionResult {
  const classification = {
    category: null,
    confidence: 0,
    source: "unknown",
    evidence: [],
    verified: false,
  };
  const confidence = { score: 0, label: "unknown" as const };
  return {
    winningCard: null,
    runnerUp: null,
    winningRule: null,
    estimatedReward: null,
    confidence,
    explanation,
    evaluatedCards: [],
    comparison: {
      mode: "direct_earning_rate",
      explanation: "No owned cards were available to compare.",
    },
    classification,
    auditLog: createDecisionAuditLog({
      merchant: "unknown",
      classification,
      evaluatedCards: [],
      winningRuleId: null,
      confidence,
    }),
  };
}

function readableCategory(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeCategory(value: unknown) {
  return normalize(value).replace(/\s+/g, "_");
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function round(value: number, digits = 4) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
