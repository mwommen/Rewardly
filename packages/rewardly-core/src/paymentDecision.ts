import type {
  Benefit,
  BenefitMatch,
  Card,
  DecisionNarrative,
  DecisionNarrativeReasonType,
  DecisionNormalizedReward,
  DecisionRewardDetails,
  DecisionReason,
  Merchant,
  PaymentDecision,
  Recommendation,
  RecommendationIntegrityValidation,
  RecommendationWinningReason,
  Wallet,
} from "./domain";

export type PaymentDecisionInput = {
  wallet: Wallet;
  merchant: Merchant;
  recommendations: Recommendation[];
  purchaseAmount?: number | null;
  generatedAt?: string;
};

export function createEmptyPaymentDecision(
  wallet: Wallet,
  merchant: Merchant,
  summary = "Rewardly could not find a confident card recommendation yet.",
): PaymentDecision {
  return {
    recommendedCard: null,
    alternativeCards: [],
    primaryReason: null,
    unlockedBenefits: [],
    winningReason: null,
    relevantBenefits: [],
    confidence: { label: "unknown" },
    recommendationSummary: summary,
    decisionNarrative: null,
    recommendationIntegrity: null,
    merchant,
    wallet: {
      userId: wallet.userId,
      source: wallet.source,
      cardSlugs: wallet.cardSlugs,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function createPaymentDecision({
  wallet,
  merchant,
  recommendations,
  purchaseAmount = null,
  generatedAt = new Date().toISOString(),
}: PaymentDecisionInput): PaymentDecision {
  const [recommendedCard, ...alternatives] = recommendations;

  if (!recommendedCard) {
    return createEmptyPaymentDecision(
      wallet,
      merchant,
      "Rewardly did not find a strong card in your wallet for this checkout.",
    );
  }

  const relevantBenefits = relevantBenefitsFor(recommendedCard);
  const winningReason =
    recommendedCard.winningReason ||
    winningReasonFor(recommendedCard, merchant, relevantBenefits);
  const confidence = confidenceFromRecommendation(recommendedCard);
  const proposedDecisionNarrative = decisionNarrativeFor({
    recommendation: recommendedCard,
    alternatives,
    merchant,
    purchaseAmount,
    winningReason,
    relevantBenefits,
    confidence,
  });
  const integrity = validateRecommendationIntegrity({
    narrative: proposedDecisionNarrative,
    recommendation: recommendedCard,
    alternatives,
    merchant,
    purchaseAmount,
    winningReason,
    relevantBenefits,
    confidence,
  });
  const decisionNarrative = integrity.narrative;

  return {
    recommendedCard,
    alternativeCards: alternatives.slice(0, 2),
    primaryReason: recommendedCard.primaryReason,
    rewardEstimate: recommendedCard.rewardEstimate,
    unlockedBenefits: relevantBenefits,
    winningReason,
    relevantBenefits,
    confidence,
    recommendationSummary: summaryFor(recommendedCard, merchant, winningReason),
    contextualInsight: insightFor(recommendedCard),
    decisionNarrative,
    recommendationIntegrity: integrity.validation,
    merchant,
    wallet: {
      userId: wallet.userId,
      source: wallet.source,
      cardSlugs: wallet.cardSlugs,
    },
    generatedAt,
  };
}

export function validateRecommendationIntegrity(input: {
  narrative: DecisionNarrative | null | undefined;
  recommendation: Recommendation;
  alternatives?: Recommendation[];
  merchant: Merchant;
  purchaseAmount?: number | null;
  winningReason: RecommendationWinningReason | null;
  relevantBenefits?: BenefitMatch[];
  confidence: { score?: number; label: "high" | "medium" | "low" | "unknown" };
}): {
  narrative: DecisionNarrative;
  validation: RecommendationIntegrityValidation;
} {
  const expected = decisionNarrativeFor({
    recommendation: input.recommendation,
    alternatives: input.alternatives || [],
    merchant: input.merchant,
    purchaseAmount: input.purchaseAmount ?? null,
    winningReason: input.winningReason,
    relevantBenefits: input.relevantBenefits || [],
    confidence: input.confidence,
  });
  const validationFailure = recommendationIntegrityFailure(
    input.narrative,
    expected,
  );

  if (validationFailure) {
    return {
      narrative: expected,
      validation: {
        valid: false,
        fallbackApplied: true,
        reason: validationFailure,
        expectedRuleId: expected.primaryReason.ruleId || null,
        expectedBenefitId: expected.primaryReason.benefitId || null,
        expectedReasonType: expected.primaryReason.type,
      },
    };
  }

  return {
    narrative: input.narrative as DecisionNarrative,
    validation: {
      valid: true,
      fallbackApplied: false,
      reason: null,
      expectedRuleId: expected.primaryReason.ruleId || null,
      expectedBenefitId: expected.primaryReason.benefitId || null,
      expectedReasonType: expected.primaryReason.type,
    },
  };
}

export function buildRecommendation(params: {
  card: Card;
  primaryReason: DecisionReason;
  rewardEstimate?: Recommendation["rewardEstimate"];
  confidence?: Recommendation["confidence"];
  unlockedBenefits?: BenefitMatch[];
  winningReason?: RecommendationWinningReason | null;
  relevantBenefits?: BenefitMatch[];
}): Recommendation {
  return {
    card: params.card,
    primaryReason: params.primaryReason,
    rewardEstimate: params.rewardEstimate,
    confidence: params.confidence,
    unlockedBenefits: params.unlockedBenefits || [],
    winningReason: params.winningReason || null,
    relevantBenefits: params.relevantBenefits,
  };
}

export function benefitFromLabel(
  label: string,
  overrides: Partial<Benefit> = {},
) {
  return {
    label,
    type: inferBenefitType(label),
    ...overrides,
  } satisfies Benefit;
}

function confidenceFromRecommendation(recommendation: Recommendation) {
  if (recommendation.confidence) {
    return {
      score: recommendation.confidence.score,
      label: recommendation.confidence.label,
    };
  }
  const hasBenefit = recommendation.unlockedBenefits.length > 0;
  const hasRewardRate = Boolean(recommendation.rewardEstimate?.effectiveRate);
  if (hasBenefit && hasRewardRate)
    return { label: "high" as const, score: 0.86 };
  if (hasBenefit || hasRewardRate)
    return { label: "medium" as const, score: 0.68 };
  return { label: "low" as const, score: 0.42 };
}

function summaryFor(
  recommendation: Recommendation,
  merchant: Merchant,
  winningReason: RecommendationWinningReason | null,
) {
  const merchantName = merchant.name || "this purchase";
  if (winningReason?.explanation) {
    return `Use ${recommendation.card.name} at ${merchantName}. ${winningReason.explanation}`;
  }
  if (recommendation.unlockedBenefits.length) {
    return `Use ${recommendation.card.name} at ${merchantName} because it unlocks a card benefit before you pay.`;
  }
  if (recommendation.rewardEstimate?.label) {
    return `Use ${recommendation.card.name} at ${merchantName} because it gives you ${recommendation.rewardEstimate.label}.`;
  }
  return `Use ${recommendation.card.name} for the strongest available value in your wallet.`;
}

function insightFor(recommendation: Recommendation) {
  const firstBenefit = recommendation.unlockedBenefits[0]?.benefit.label;
  if (!firstBenefit) {
    return "Rewardly compares the cards you already own before you pay.";
  }
  if (/protection|insurance|warranty/i.test(firstBenefit)) {
    return "Protections usually only apply when you pay with the card that includes them.";
  }
  if (/credit/i.test(firstBenefit)) {
    return "Credits can expire or require enrollment, so the right card matters at checkout.";
  }
  return "Card benefits are easy to miss unless you check them before paying.";
}

function dedupeBenefitMatches(matches: BenefitMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.card.slug}:${match.benefit.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function relevantBenefitsFor(recommendation: Recommendation) {
  return dedupeBenefitMatches(
    recommendation.relevantBenefits || recommendation.unlockedBenefits || [],
  );
}

function winningReasonFor(
  recommendation: Recommendation,
  merchant: Merchant,
  relevantBenefits: BenefitMatch[],
): RecommendationWinningReason | null {
  const merchantName = merchant.name || "this purchase";
  const firstBenefit = relevantBenefits[0];
  if (firstBenefit) {
    return {
      type: reasonTypeFor(firstBenefit.benefit.label),
      merchantName,
      title: firstBenefit.benefit.label,
      explanation: explanationForBenefit(
        firstBenefit.benefit.label,
        merchantName,
      ),
      estimatedValue: recommendation.rewardEstimate?.estimatedValueUSD,
      applicableToPurchase: true,
      influencedRecommendation: true,
      sourceBenefitId: firstBenefit.benefit.id,
    };
  }

  const rate = recommendation.rewardEstimate?.effectiveRate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  const earningLabel =
    catchAllEarningLabel(recommendation.card.perks || [], rate) ||
    rewardTitle(rate, rewardUnitFor(recommendation.card));
  const rewardUnit = rewardUnitFor(recommendation.card);
  return {
    type: "catch_all_reward",
    merchantName,
    title: earningLabel,
    explanation: `Earn ${earningLabel.toLowerCase()} on this ${merchantName} purchase.`,
    rewardRate: rate,
    rewardUnit,
    estimatedValue: recommendation.rewardEstimate?.estimatedValueUSD,
    applicableToPurchase: true,
    influencedRecommendation: true,
  };
}

function reasonTypeFor(label: string): RecommendationWinningReason["type"] {
  if (/offer/i.test(label)) return "merchant_offer";
  if (/credit|statement/i.test(label)) return "merchant_credit";
  if (/rotating|quarter/i.test(label)) return "rotating_category";
  if (/portal|booked through|booked via/i.test(label)) return "portal_reward";
  if (/\d+(\.\d+)?\s*(x|%|points|miles|cash back)/i.test(label)) {
    return "category_reward";
  }
  return "other";
}

function explanationForBenefit(label: string, merchantName: string) {
  if (/at|with|on/i.test(label)) return label;
  return `${label} applies to this ${merchantName} purchase.`;
}

function catchAllEarningLabel(perks: string[], rate: number) {
  const expectedRates = [rateLabel(rate)];
  if (rate < 1) expectedRates.push(rateLabel(rate * 100));
  const match = perks.find(
    (perk) =>
      /\b(every|all|all other|everyday)\b/i.test(perk) &&
      expectedRates.some((expectedRate) =>
        new RegExp(escapeRegExp(expectedRate), "i").test(perk),
      ),
  );
  if (!match) return null;
  const clean = match.trim().replace(/[.。]+$/g, "");
  return clean.replace(/\bon\b.*$/i, "").trim() || clean;
}

function rewardTitle(
  rate: number,
  unit: RecommendationWinningReason["rewardUnit"],
) {
  const label =
    unit === "miles" || unit === "points"
      ? rateLabel(multiplierRate(rate))
      : rateLabel(rate);
  if (unit === "miles") return `${label} miles`;
  if (unit === "points") return `${label} points`;
  if (unit === "cash") return `${label} cash back`;
  return `${label} rewards`;
}

function rateLabel(rate: number) {
  if (rate < 1) {
    const percent = rate * 100;
    return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
  }
  return `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1)}x`;
}

function multiplierRate(rate: number) {
  return rate < 1 ? rate * 100 : rate;
}

function rewardUnitFor(card: Card): RecommendationWinningReason["rewardUnit"] {
  const text = `${card.name} ${(card.perks || []).join(" ")}`.toLowerCase();
  if (/mile/.test(text)) return "miles";
  if (/point|membership reward/.test(text)) return "points";
  if (/cash/.test(text)) return "cash";
  return "percent";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decisionNarrativeFor(input: {
  recommendation: Recommendation;
  alternatives: Recommendation[];
  merchant: Merchant;
  purchaseAmount: number | null;
  winningReason: RecommendationWinningReason | null;
  relevantBenefits: BenefitMatch[];
  confidence: { score?: number; label: "high" | "medium" | "low" | "unknown" };
}): DecisionNarrative {
  const merchantName = input.merchant.name || "this purchase";
  const reasonType = narrativeReasonType(input.winningReason);
  const rate = input.winningReason?.rewardRate ||
    input.recommendation.rewardEstimate?.effectiveRate ||
    null;
  const rewardUnit = narrativeRewardUnit(input.winningReason);
  const rewardDetails = rewardDetailsForNarrative(
    input.purchaseAmount,
    rate,
    rewardUnit,
    input.winningReason,
    merchantName,
    reasonType,
  );
  const estimatedReward = rewardDetails?.estimatedDisplay || null;
  const reward = normalizedRewardFor(rewardDetails);
  const earningText = earningTextFor(reward);
  const comparison = comparisonFor(
    input.recommendation,
    input.alternatives[0] || null,
    rewardUnit,
    input.confidence.label,
    input.purchaseAmount,
  );
  const headline = headlineForNarrative({
    merchantName,
    reasonType,
    winningReason: input.winningReason,
    rate,
    rewardUnit,
    rewardDetails,
  });
  const summary = summaryForNarrative({
    merchantName,
    reasonType,
    confidence: input.confidence.label,
  });
  const reasonText = reasonTextForNarrative({
    reasonType,
    merchantName,
    winningReason: input.winningReason,
    reward,
  });
  const scoreContribution =
    typeof input.recommendation.rewardEstimate?.estimatedValueUSD === "number"
      ? input.recommendation.rewardEstimate.estimatedValueUSD
      : rate;

  return {
    merchant: merchantName,
    purchaseAmount: input.purchaseAmount,
    recommendedCard: {
      slug: input.recommendation.card.slug,
      name: input.recommendation.card.name,
      issuer: input.recommendation.card.issuer,
    },
    reasonType,
    headline,
    summary,
    estimatedReward,
    estimatedRewardUnit: rewardUnit,
    estimatedRewardValue: input.winningReason?.estimatedValue ??
      input.recommendation.rewardEstimate?.estimatedValueUSD ??
      null,
    rewardDetails,
    reward,
    earningText,
    estimatedRewardText: estimatedReward,
    comparisonText: comparison,
    reasonText,
    incrementalValue: incrementalValueFor(
      input.recommendation,
      input.alternatives[0] || null,
    ),
    comparison,
    confidence: narrativeConfidence(input.confidence.label),
    primaryReason: {
      type: reasonType,
      headline,
      summary: reasonText,
      ruleId: input.winningReason?.sourceRuleId || null,
      benefitId: input.winningReason?.sourceBenefitId || null,
      scoreContribution,
    },
    supportingReasons: [],
    scoringEvidence: [
      {
        label: "winning_reason_type",
        value: reasonType,
        source: input.winningReason?.sourceRuleId || null,
      },
      {
        label: "effective_rate",
        value: rate,
        source: "recommendation_scoring",
      },
      {
        label: "estimated_value_usd",
        value: input.recommendation.rewardEstimate?.estimatedValueUSD ?? null,
        source: "recommendation_scoring",
      },
      {
        label: "relevant_benefit_count",
        value: input.relevantBenefits.length,
        source: "payment_decision",
      },
    ],
  };
}

function recommendationIntegrityFailure(
  narrative: DecisionNarrative | null | undefined,
  expected: DecisionNarrative,
) {
  if (!narrative) return "missing decision narrative";
  if (narrative.recommendedCard.slug !== expected.recommendedCard.slug) {
    return "narrative card does not match winning card";
  }
  if (narrative.reasonType !== expected.reasonType) {
    return "narrative reason type does not match winning rule";
  }
  if (narrative.primaryReason.type !== expected.primaryReason.type) {
    return "primary reason type does not match winning rule";
  }
  if (
    normalizeTraceId(narrative.primaryReason.ruleId) !==
    normalizeTraceId(expected.primaryReason.ruleId)
  ) {
    return "primary reason rule id does not match winning rule";
  }
  if (
    normalizeTraceId(narrative.primaryReason.benefitId) !==
    normalizeTraceId(expected.primaryReason.benefitId)
  ) {
    return "primary reason benefit id does not match winning benefit";
  }
  if (
    normalizedDisplayText(narrative.primaryReason.headline) !==
    normalizedDisplayText(expected.primaryReason.headline)
  ) {
    return "primary reason headline does not match winning rule";
  }
  if (
    normalizedDisplayText(narrative.headline) !==
    normalizedDisplayText(expected.headline)
  ) {
    return "headline does not match winning rule";
  }
  if (
    normalizedDisplayText(narrative.summary) !==
    normalizedDisplayText(expected.summary)
  ) {
    return "summary does not match winning rule";
  }
  if (
    normalizedDisplayText(narrative.estimatedReward || "") !==
    normalizedDisplayText(expected.estimatedReward || "")
  ) {
    return "estimated reward does not match winning rule";
  }
  if (
    normalizedDisplayText(JSON.stringify(narrative.rewardDetails || null)) !==
    normalizedDisplayText(JSON.stringify(expected.rewardDetails || null))
  ) {
    return "reward details do not match winning rule";
  }
  if (
    normalizedDisplayText(JSON.stringify(narrative.reward || null)) !==
    normalizedDisplayText(JSON.stringify(expected.reward || null))
  ) {
    return "normalized reward does not match winning rule";
  }
  if (
    normalizedDisplayText(narrative.earningText || "") !==
    normalizedDisplayText(expected.earningText || "")
  ) {
    return "earning text does not match winning rule";
  }
  if (
    normalizedDisplayText(narrative.estimatedRewardText || "") !==
    normalizedDisplayText(expected.estimatedRewardText || "")
  ) {
    return "estimated reward text does not match winning rule";
  }
  if (
    normalizedDisplayText(narrative.reasonText || "") !==
    normalizedDisplayText(expected.reasonText || "")
  ) {
    return "reason text does not match winning rule";
  }
  if (
    normalizedDisplayText(narrative.comparisonText || "") !==
    normalizedDisplayText(expected.comparisonText || "")
  ) {
    return "comparison text does not match winning rule";
  }
  const unrelatedSupportingReason = narrative.supportingReasons.find(
    (reason) =>
      normalizeTraceId(reason.ruleId) !==
        normalizeTraceId(expected.primaryReason.ruleId) ||
      normalizeTraceId(reason.benefitId) !==
        normalizeTraceId(expected.primaryReason.benefitId),
  );
  if (unrelatedSupportingReason) {
    return "supporting reason references a non-winning rule or benefit";
  }
  return null;
}

function normalizeTraceId(value?: string | null) {
  return value || null;
}

function normalizedDisplayText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function narrativeReasonType(
  reason: RecommendationWinningReason | null,
): DecisionNarrativeReasonType {
  if (!reason) return "fallback";
  if (reason.type === "merchant_credit") return "statement_credit";
  if (reason.type === "category_reward") return "category_bonus";
  return reason.type === "other" ? "fallback" : reason.type;
}

function narrativeReasonTypeForBenefit(label: string): DecisionNarrativeReasonType {
  return narrativeReasonType({
    type: reasonTypeFor(label),
    title: label,
    explanation: label,
    applicableToPurchase: true,
    influencedRecommendation: true,
  });
}

function narrativeRewardUnit(
  reason: RecommendationWinningReason | null,
): DecisionNarrative["estimatedRewardUnit"] {
  if (!reason?.rewardUnit) return "unknown";
  if (reason.rewardUnit === "percent") return "cash";
  return reason.rewardUnit;
}

function rewardDetailsForNarrative(
  amount: number | null,
  rate: number | null,
  unit: DecisionNarrative["estimatedRewardUnit"],
  reason: RecommendationWinningReason | null,
  merchantName: string,
  reasonType: DecisionNarrativeReasonType,
): DecisionRewardDetails | null {
  if (reasonType === "statement_credit") {
    const creditAmount = statementCreditAmount(reason);
    if (creditAmount === null) return null;
    return {
      rate: null,
      unit: "statement_credit",
      programName: `${merchantName} statement credit`,
      estimatedQuantity: null,
      displayQuantity: null,
      purchaseAmount: amount,
      estimatedCashBack: null,
      displayCashBack: null,
      creditAmount,
      applicableCreditAmount: creditAmount,
      estimatedDisplay: `Up to ${formatCurrency(creditAmount)} back.`,
    };
  }
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    if (
      (unit === "miles" || unit === "points") &&
      typeof rate === "number" &&
      Number.isFinite(rate) &&
      rate > 0
    ) {
      const displayRate = multiplierRate(rate);
      const programName = rewardProgramLabelForNarrative(unit, reason);
      return {
        rate: displayRate,
        unit: unit === "miles" ? "miles_per_dollar" : "points_per_dollar",
        programName,
        estimatedQuantity: null,
        displayQuantity: null,
        purchaseAmount: null,
        estimatedCashBack: null,
        displayCashBack: null,
        creditAmount: null,
        applicableCreditAmount: null,
        estimatedDisplay: `Estimated ${unit} will update when Rewardly can read the final total.`,
      };
    }
    return null;
  }
  const displayRate = multiplierRate(rate);
  if (unit === "miles" || unit === "points") {
    const estimatedQuantity = amount * displayRate;
    const roundedQuantity = Math.round(estimatedQuantity);
    const programName = rewardProgramLabelForNarrative(unit, reason);
    return {
      rate: displayRate,
      unit: unit === "miles" ? "miles_per_dollar" : "points_per_dollar",
      programName,
      estimatedQuantity: roundToTwo(estimatedQuantity),
      displayQuantity: `${roundedQuantity} ${programName}`,
      purchaseAmount: amount,
      estimatedCashBack: null,
      displayCashBack: null,
      creditAmount: null,
      applicableCreditAmount: null,
      estimatedDisplay: `About ${roundedQuantity} ${programName} on this ${formatCurrency(
        amount,
      )} purchase.`,
    };
  }
  const value = amount * (rate < 1 ? rate : rate / 100);
  return {
    rate: displayRate,
    unit: unit === "cash" ? "cash_back_percent" : "unknown",
    programName: unit === "cash" ? "cash back" : null,
    estimatedQuantity: null,
    displayQuantity: null,
    purchaseAmount: amount,
    estimatedCashBack: unit === "cash" ? roundToTwo(value) : null,
    displayCashBack: unit === "cash" ? formatCurrency(value) : null,
    creditAmount: null,
    applicableCreditAmount: null,
    estimatedDisplay:
      unit === "cash"
        ? `About ${formatCurrency(value)} back on this ${formatCurrency(
            amount,
          )} purchase.`
        : null,
  };
}

function normalizedRewardFor(
  details: DecisionRewardDetails | null,
): DecisionNormalizedReward | null {
  if (!details) return null;
  if (details.unit === "miles_per_dollar") {
    return {
      type: "miles",
      programName: details.programName || "Miles",
      earningRate: details.rate ?? null,
      earningUnit: "miles_per_dollar",
      estimatedRewardQuantity: details.estimatedQuantity ?? null,
      estimatedRewardCashValue: null,
      purchaseAmount: details.purchaseAmount ?? null,
    };
  }
  if (details.unit === "points_per_dollar") {
    return {
      type: "points",
      programName: details.programName || "Points",
      earningRate: details.rate ?? null,
      earningUnit: "points_per_dollar",
      estimatedRewardQuantity: details.estimatedQuantity ?? null,
      estimatedRewardCashValue: null,
      purchaseAmount: details.purchaseAmount ?? null,
    };
  }
  if (details.unit === "cash_back_percent") {
    return {
      type: "cash_back",
      programName: details.programName || "Cash Back",
      earningRate: details.rate ?? null,
      earningUnit: "percent_back",
      estimatedRewardQuantity: null,
      estimatedRewardCashValue: details.estimatedCashBack ?? null,
      purchaseAmount: details.purchaseAmount ?? null,
    };
  }
  if (details.unit === "statement_credit") {
    return {
      type: "statement_credit",
      programName: details.programName || "Statement Credit",
      earningRate: details.creditAmount ?? null,
      earningUnit: "flat_credit",
      estimatedRewardQuantity: null,
      estimatedRewardCashValue: details.applicableCreditAmount ?? null,
      purchaseAmount: details.purchaseAmount ?? null,
    };
  }
  return {
    type: "unknown",
    programName: details.programName || null,
    earningRate: details.rate ?? null,
    earningUnit: "unknown",
    estimatedRewardQuantity: details.estimatedQuantity ?? null,
    estimatedRewardCashValue: details.estimatedCashBack ?? null,
    purchaseAmount: details.purchaseAmount ?? null,
  };
}

function earningTextFor(reward: DecisionNormalizedReward | null) {
  if (!reward) return null;
  if (
    (reward.type === "miles" || reward.type === "points") &&
    typeof reward.earningRate === "number" &&
    reward.programName
  ) {
    return `${formatRate(reward.earningRate)}x ${reward.programName}`;
  }
  if (
    reward.type === "cash_back" &&
    typeof reward.earningRate === "number"
  ) {
    return `${formatRate(reward.earningRate)}% cash back`;
  }
  if (
    reward.type === "statement_credit" &&
    typeof reward.earningRate === "number"
  ) {
    return `${formatCurrency(reward.earningRate)} statement credit`;
  }
  return null;
}

function rewardProgramLabelForNarrative(
  unit: DecisionNarrative["estimatedRewardUnit"],
  reason: RecommendationWinningReason | null,
) {
  if (unit === "miles") {
    const text = `${reason?.title || ""} ${reason?.explanation || ""}`.toLowerCase();
    if (/venture/.test(text)) return "Venture Miles";
    return "miles";
  }
  if (unit === "points") {
    const text = `${reason?.title || ""} ${reason?.explanation || ""}`.toLowerCase();
    if (/membership reward/.test(text)) return "Membership Rewards points";
    if (/ultimate reward/.test(text)) return "Ultimate Rewards points";
    if (/thankyou/.test(text)) return "ThankYou Points";
    return "points";
  }
  return String(unit || "rewards");
}

function statementCreditAmount(reason: RecommendationWinningReason | null) {
  if (typeof reason?.estimatedValue === "number" && reason.estimatedValue > 0) {
    return roundToTwo(reason.estimatedValue);
  }
  const text = `${reason?.title || ""} ${reason?.explanation || ""}`;
  const match = text.match(/\$(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? roundToTwo(value) : null;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(Number.isInteger(value) ? 0 : 2)}`;
}

function formatRate(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function comparisonFor(
  recommendation: Recommendation,
  alternative: Recommendation | null,
  unit: DecisionNarrative["estimatedRewardUnit"],
  confidence: "high" | "medium" | "low" | "unknown",
  amount: number | null,
) {
  if (confidence !== "high") return null;
  if (unit === "miles") {
    const delta = rewardQuantityDelta(recommendation, alternative, amount);
    return delta && delta > 0
      ? `Earn about ${Math.round(delta)} more miles than your next-best card.`
      : null;
  }
  if (unit === "points") {
    const delta = rewardQuantityDelta(recommendation, alternative, amount);
    return delta && delta > 0
      ? `Earn about ${Math.round(delta)} more points than your next-best card.`
      : null;
  }
  const delta = incrementalValueFor(recommendation, alternative);
  if (delta === null || delta <= 0) return null;
  return `About $${delta.toFixed(2)} more value than your next-best card.`;
}

function rewardQuantityDelta(
  recommendation: Recommendation,
  alternative: Recommendation | null,
  amount: number | null,
) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const winnerRate = recommendation.rewardEstimate?.effectiveRate;
  const runnerUpRate = alternative?.rewardEstimate?.effectiveRate;
  if (
    typeof winnerRate !== "number" ||
    !Number.isFinite(winnerRate) ||
    typeof runnerUpRate !== "number" ||
    !Number.isFinite(runnerUpRate)
  ) {
    return null;
  }
  return Math.max(0, amount * (multiplierRate(winnerRate) - multiplierRate(runnerUpRate)));
}

function incrementalValueFor(
  recommendation: Recommendation,
  alternative: Recommendation | null,
) {
  const winner = recommendation.rewardEstimate?.estimatedValueUSD;
  const runnerUp = alternative?.rewardEstimate?.estimatedValueUSD;
  if (typeof winner !== "number" || typeof runnerUp !== "number") return null;
  return Math.max(0, Math.round((winner - runnerUp) * 100) / 100);
}

function headlineForNarrative(input: {
  merchantName: string;
  reasonType: DecisionNarrativeReasonType;
  winningReason: RecommendationWinningReason | null;
  rate: number | null;
  rewardUnit: DecisionNarrative["estimatedRewardUnit"];
  rewardDetails: DecisionRewardDetails | null;
}) {
  if (!input.winningReason) {
    return safeFallbackNarrativeHeadline();
  }
  if (
    input.reasonType === "statement_credit" &&
    input.rewardDetails?.creditAmount
  ) {
    return `This purchase qualifies for your ${formatCurrency(
      input.rewardDetails.creditAmount,
    )} ${input.merchantName} statement credit.`;
  }
  if (
    input.rewardDetails?.unit === "miles_per_dollar" ||
    input.rewardDetails?.unit === "points_per_dollar"
  ) {
    return `Earn ${formatRate(input.rewardDetails.rate)}x ${
      input.rewardDetails.programName
    } on this ${headlinePurchaseSubject(input)} purchase.`;
  }
  if (input.rewardDetails?.unit === "cash_back_percent") {
    return `Earn ${formatRate(
      input.rewardDetails.rate,
    )}% back on this ${headlinePurchaseSubject(input)} purchase.`;
  }
  if (input.rewardUnit === "unknown") {
    return safeFallbackNarrativeHeadline();
  }
  if (input.reasonType === "catch_all_reward" && input.winningReason.explanation) {
    return input.winningReason.explanation;
  }
  if (input.reasonType === "catch_all_reward" && input.rate) {
    return `Earn ${rewardTitleForNarrative(
      input.rate,
      input.rewardUnit,
    )} on ${purchasePhraseFor(input.merchantName)}.`;
  }
  if (
    input.reasonType === "merchant_reward" ||
    input.reasonType === "category_bonus" ||
    input.reasonType === "rotating_category"
  ) {
    return input.winningReason.explanation || input.winningReason.title;
  }
  return input.winningReason.explanation || input.winningReason.title;
}

function safeFallbackNarrativeHeadline() {
  return "This card earns the highest verified rewards among the eligible cards in your wallet.";
}

function reasonTextForNarrative(input: {
  reasonType: DecisionNarrativeReasonType;
  merchantName: string;
  winningReason: RecommendationWinningReason | null;
  reward: DecisionNormalizedReward | null;
}) {
  if (!input.winningReason || input.reward?.type === "unknown") {
    return "Highest verified rewards among your wallet.";
  }
  if (input.reasonType === "merchant_offer") {
    return "This purchase qualifies for your enrolled merchant offer.";
  }
  if (input.reasonType === "statement_credit") {
    return `This purchase qualifies for your ${input.merchantName} statement credit.`;
  }
  if (input.reasonType === "merchant_reward") {
    return `${input.merchantName} is bonused by this card for this purchase.`;
  }
  if (
    input.reasonType === "category_bonus" ||
    input.reasonType === "rotating_category"
  ) {
    return "This purchase matches the card's bonus category.";
  }
  if (input.reasonType === "catch_all_reward") {
    return "Highest verified earning rate among the eligible cards in your wallet.";
  }
  return "Highest verified rewards among your wallet.";
}

function headlinePurchaseSubject(input: {
  merchantName: string;
  reasonType: DecisionNarrativeReasonType;
  winningReason: RecommendationWinningReason | null;
}) {
  if (
    (input.reasonType === "category_bonus" ||
      input.reasonType === "rotating_category") &&
    input.winningReason?.merchantName &&
    normalizedDisplayText(input.winningReason.merchantName) !==
      normalizedDisplayText(input.merchantName)
  ) {
    return input.winningReason.merchantName;
  }
  return input.merchantName;
}

function purchasePhraseFor(merchantName: string) {
  if (!merchantName || /^this purchase$/i.test(merchantName)) {
    return "this purchase";
  }
  return `this ${merchantName} purchase`;
}

function rewardTitleForNarrative(
  rate: number,
  unit: DecisionNarrative["estimatedRewardUnit"],
) {
  const label =
    unit === "miles" || unit === "points"
      ? rateLabel(multiplierRate(rate))
      : rateLabel(rate);
  if (unit === "miles") return `${label} miles`;
  if (unit === "points") return `${label} points`;
  if (unit === "cash") return rate < 1 ? `${rateLabel(rate)} back` : `${label} rewards`;
  return `${label} rewards`;
}

function summaryForNarrative(input: {
  merchantName: string;
  reasonType: DecisionNarrativeReasonType;
  confidence: "high" | "medium" | "low" | "unknown";
}) {
  if (input.confidence === "low" || input.confidence === "unknown") {
    return "Rewardly found the strongest eligible option in your wallet using available checkout signals.";
  }
  if (input.reasonType === "merchant_offer") {
    return `This purchase qualifies for your enrolled ${input.merchantName} offer.`;
  }
  if (input.reasonType === "statement_credit") {
    return `This purchase qualifies for your ${input.merchantName} statement credit.`;
  }
  if (input.reasonType === "category_bonus") {
    return `This category bonus beats every other eligible card you own.`;
  }
  return "Highest verified earning rate among the eligible cards in your wallet.";
}

function narrativeConfidence(label: "high" | "medium" | "low" | "unknown") {
  if (label === "high") return "HIGH";
  if (label === "medium") return "MEDIUM";
  return "LOW";
}

function inferBenefitType(label: string): Benefit["type"] {
  if (/credit|cash/i.test(label)) return "credit";
  if (/protection|warranty/i.test(label)) return "protection";
  if (/insurance|coverage/i.test(label)) return "insurance";
  if (/lounge|precheck|global entry|travel/i.test(label)) return "travel_perk";
  if (/offer/i.test(label)) return "offer";
  return "other";
}
