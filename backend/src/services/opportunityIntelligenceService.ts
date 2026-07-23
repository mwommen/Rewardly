import type { PaymentDecision } from "../../../packages/rewardly-core/src";
import type { CanonicalWalletBenefitState } from "./walletIntelligenceService";

export type OpportunityType =
  | "unused_monthly_credit"
  | "unused_annual_credit"
  | "quarterly_category_ending"
  | "benefit_expiring_soon"
  | "spend_threshold_progress"
  | "welcome_bonus_progress"
  | "companion_pass_progress"
  | "free_night_progress"
  | "elite_status_progress"
  | "anniversary_benefit"
  | "retention_opportunity"
  | "unused_lounge_access"
  | "travel_credit_remaining"
  | "dining_credit_remaining"
  | "streaming_credit_remaining"
  | "shopping_credit_remaining";

export type OpportunityPriority = "critical" | "high" | "medium" | "low";
export type OpportunityStatus = "active" | "completed" | "dismissed" | "expired" | "ignored" | "archived";

export type OpportunityEvidence = {
  type: "wallet_state" | "benefit" | "timeline" | "recommendation" | "behavior" | "estimate";
  label: string;
  value: unknown;
  confidence: number;
};

export type CanonicalOpportunity = {
  opportunityId: string;
  userId: string;
  opportunityType: OpportunityType;
  priority: OpportunityPriority;
  estimatedValue: {
    amountUSD: number;
    valueType: "saved" | "earned" | "protected" | "unlocked" | "avoided_loss";
    ifIgnoredUSD: number;
    ifCompletedUSD: number;
  };
  expirationDate: string | null;
  confidence: number;
  title: string;
  summary: string;
  recommendation: string;
  supportingEvidence: OpportunityEvidence[];
  actionRequired: string;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityDetectionContext = {
  userId: string;
  walletBenefitStates: CanonicalWalletBenefitState[];
  decision?: PaymentDecision | null;
  now?: string | Date;
  historicalBehavior?: {
    dismissedOpportunityTypes?: OpportunityType[];
    completedOpportunityTypes?: OpportunityType[];
    recommendationFrequency?: Record<string, number>;
  };
};

export type OpportunityTimelineItem = {
  timelineId: string;
  date: string;
  eventType:
    | "monthly_reset"
    | "annual_renewal"
    | "quarterly_category_change"
    | "benefit_expiration"
    | "annual_fee"
    | "status_expiration"
    | "welcome_bonus_deadline";
  title: string;
  opportunityId: string | null;
  priority: OpportunityPriority;
};

export type OpportunitySimulation = {
  opportunityId: string;
  ifIgnored: {
    estimatedValueLostUSD: number;
    creditsForfeitedUSD: number;
    pointsMissed: number;
    statusDelayed: boolean;
  };
  ifCompleted: {
    estimatedValueGainedUSD: number;
    projectedRewardsUSD: number;
    milestonesUnlocked: string[];
  };
  deterministicHash: string;
};

export type OpportunityInsight = {
  insightType:
    | "highest_value_opportunity"
    | "most_urgent_opportunity"
    | "benefits_never_used"
    | "frequently_missed_credits"
    | "largest_remaining_benefit"
    | "most_valuable_card"
    | "monthly_opportunity_summary"
    | "annual_opportunity_summary"
    | "potential_value_remaining";
  title: string;
  summary: string;
  opportunityIds: string[];
  estimatedValueUSD: number;
};

export type OpportunityAnalyticsEvent = {
  eventId: string;
  eventType:
    | "opportunity_created"
    | "opportunity_completed"
    | "opportunity_ignored"
    | "opportunity_expired"
    | "opportunity_dismissed"
    | "estimated_value_saved"
    | "estimated_value_lost"
    | "detection_accuracy"
    | "average_time_to_completion";
  userId: string;
  opportunityId: string | null;
  amountUSD: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OpportunityReport = {
  userId: string;
  generatedAt: string;
  opportunities: CanonicalOpportunity[];
  timeline: OpportunityTimelineItem[];
  simulations: OpportunitySimulation[];
  insights: OpportunityInsight[];
  analytics: OpportunityAnalyticsEvent[];
  totals: {
    activeCount: number;
    estimatedValueRemainingUSD: number;
    estimatedValueAtRiskUSD: number;
  };
};

export type OpportunityRule = {
  ruleId: OpportunityType;
  description: string;
  detect(context: Required<Pick<OpportunityDetectionContext, "userId" | "walletBenefitStates">> & {
    decision?: PaymentDecision | null;
    now: Date;
    historicalBehavior?: OpportunityDetectionContext["historicalBehavior"];
  }): CanonicalOpportunity[];
};

const DEFAULT_NOW = "2026-07-22T00:00:00.000Z";
const EXPIRING_SOON_DAYS = 30;

export const OPPORTUNITY_RULES: OpportunityRule[] = [
  {
    ruleId: "unused_monthly_credit",
    description: "Find monthly statement credits with value left in the current cycle.",
    detect: (context) =>
      context.walletBenefitStates
        .filter((state) => state.cycleFrequency === "monthly")
        .filter(hasRemainingValue)
        .filter((state) => !isExpired(state, context.now))
        .map((state) =>
          opportunityFromState({
            state,
            now: context.now,
            opportunityType: typeForCreditState(state, "unused_monthly_credit"),
            title: titleForCredit(state),
            summary: `$${money(state.remainingValue)} remains before this monthly credit resets.`,
            recommendation: "Use this benefit before the monthly reset if it fits a purchase you already planned.",
            actionRequired: actionForState(state),
            valueType: "avoided_loss",
          }),
        ),
  },
  {
    ruleId: "unused_annual_credit",
    description: "Find annual credits with remaining value before expiration or annual reset.",
    detect: (context) =>
      context.walletBenefitStates
        .filter((state) => state.cycleFrequency === "annual")
        .filter(hasRemainingValue)
        .filter((state) => !isExpired(state, context.now))
        .map((state) =>
          opportunityFromState({
            state,
            now: context.now,
            opportunityType: typeForCreditState(state, "unused_annual_credit"),
            title: titleForCredit(state),
            summary: `$${money(state.remainingValue)} remains on this annual benefit.`,
            recommendation: "Plan a qualifying purchase before the benefit resets.",
            actionRequired: actionForState(state),
            valueType: "avoided_loss",
          }),
        ),
  },
  {
    ruleId: "quarterly_category_ending",
    description: "Find active quarterly categories near the end of their cycle.",
    detect: (context) =>
      context.walletBenefitStates
        .filter((state) => state.cycleFrequency === "quarterly")
        .filter((state) => daysUntil(state.cycleEndsAt, context.now) <= 21)
        .filter((state) => daysUntil(state.cycleEndsAt, context.now) >= 0)
        .map((state) =>
          opportunityFromState({
            state,
            now: context.now,
            opportunityType: "quarterly_category_ending",
            title: "Quarterly category ending soon",
            summary: "A quarterly reward category is close to ending.",
            recommendation: "Use the category only for purchases you already planned before the quarter ends.",
            actionRequired: actionForState(state),
            valueType: "earned",
          }),
        ),
  },
  {
    ruleId: "benefit_expiring_soon",
    description: "Find benefits with upcoming expiration dates.",
    detect: (context) =>
      context.walletBenefitStates
        .filter((state) => daysUntil(state.expirationDate, context.now) <= EXPIRING_SOON_DAYS)
        .filter((state) => daysUntil(state.expirationDate, context.now) >= 0)
        .map((state) =>
          opportunityFromState({
            state,
            now: context.now,
            opportunityType: "benefit_expiring_soon",
            title: "Benefit expiring soon",
            summary: "A wallet benefit is close to expiring.",
            recommendation: "Review this benefit before it disappears from your wallet.",
            actionRequired: actionForState(state),
            valueType: "avoided_loss",
          }),
        ),
  },
  {
    ruleId: "spend_threshold_progress",
    description: "Find benefits where the user is close to a spend threshold.",
    detect: (context) =>
      context.walletBenefitStates
        .filter((state) => Number.isFinite(state.remainingSpendCap) && Number(state.remainingSpendCap) > 0)
        .filter((state) => state.currentSpend > 0)
        .map((state) =>
          opportunityFromState({
            state,
            now: context.now,
            opportunityType: milestoneTypeFromState(state),
            title: "Spend milestone in progress",
            summary: `$${money(state.remainingSpendCap)} remains toward this tracked wallet milestone.`,
            recommendation: "Only continue progress if the card still fits your normal spending.",
            actionRequired: actionForState(state),
            valueType: "unlocked",
          }),
        ),
  },
  {
    ruleId: "unused_lounge_access",
    description: "Find active lounge access benefits that have unused visits.",
    detect: (context) =>
      context.walletBenefitStates
        .filter((state) => /lounge|priority-pass|airport/i.test(state.benefitId))
        .filter((state) => state.remainingUses === null || Number(state.remainingUses) > 0)
        .filter((state) => !isExpired(state, context.now))
        .map((state) =>
          opportunityFromState({
            state,
            now: context.now,
            opportunityType: "unused_lounge_access",
            title: "Airport lounge access available",
            summary: "Your wallet includes lounge access that may be useful before a trip.",
            recommendation: "Check eligible lounges before heading to the airport.",
            actionRequired: "Check access rules before traveling.",
            valueType: "unlocked",
          }),
        ),
  },
];

export function detectOpportunities(context: OpportunityDetectionContext): CanonicalOpportunity[] {
  const normalized = {
    userId: context.userId,
    walletBenefitStates: context.walletBenefitStates || [],
    decision: context.decision || null,
    now: new Date(context.now || DEFAULT_NOW),
    historicalBehavior: context.historicalBehavior,
  };
  const detected = OPPORTUNITY_RULES.flatMap((rule) => rule.detect(normalized));
  const checkoutContext = opportunitiesFromDecisionContext(normalized);
  return prioritizeOpportunities(
    suppressDuplicateOpportunities([...detected, ...checkoutContext], normalized.historicalBehavior),
    normalized.historicalBehavior,
  );
}

export function prioritizeOpportunities(
  opportunities: CanonicalOpportunity[],
  behavior?: OpportunityDetectionContext["historicalBehavior"],
): CanonicalOpportunity[] {
  const dismissed = new Set(behavior?.dismissedOpportunityTypes || []);
  return opportunities
    .map((opportunity) => ({
      ...opportunity,
      priority: dismissed.has(opportunity.opportunityType)
        ? downgradePriority(opportunity.priority)
        : opportunity.priority,
    }))
    .sort((a, b) => opportunityScore(b) - opportunityScore(a))
    .slice(0, 8);
}

export function suppressDuplicateOpportunities(
  opportunities: CanonicalOpportunity[],
  behavior?: OpportunityDetectionContext["historicalBehavior"],
): CanonicalOpportunity[] {
  const frequency = behavior?.recommendationFrequency || {};
  const seen = new Set<string>();
  return opportunities.filter((opportunity) => {
    const key = [
      opportunity.userId,
      opportunity.opportunityType,
      opportunity.supportingEvidence.find((item) => item.type === "wallet_state")?.value || opportunity.title,
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return (frequency[opportunity.opportunityId] || 0) < 3;
  });
}

export function generateOpportunityTimeline(
  opportunities: CanonicalOpportunity[],
  states: CanonicalWalletBenefitState[] = [],
): OpportunityTimelineItem[] {
  const opportunityItems = opportunities
    .filter((opportunity) => opportunity.expirationDate)
    .map((opportunity) => timelineItem({
      date: opportunity.expirationDate as string,
      eventType: eventTypeForOpportunity(opportunity.opportunityType),
      title: opportunity.title,
      opportunityId: opportunity.opportunityId,
      priority: opportunity.priority,
    }));
  const resetItems = states
    .filter((state) => state.resetDate || state.cycleEndsAt)
    .map((state) => timelineItem({
      date: state.resetDate || state.cycleEndsAt || DEFAULT_NOW,
      eventType: state.cycleFrequency === "annual" ? "annual_renewal" : state.cycleFrequency === "quarterly" ? "quarterly_category_change" : "monthly_reset",
      title: `${labelFromBenefitId(state.benefitId)} reset`,
      opportunityId: null,
      priority: "medium",
    }));
  return [...opportunityItems, ...resetItems]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((item, index, all) => all.findIndex((other) => other.timelineId === item.timelineId) === index);
}

export function simulateOpportunity(opportunity: CanonicalOpportunity): OpportunitySimulation {
  const amount = opportunity.estimatedValue.amountUSD;
  const statusRelated = /status|companion|night/i.test(opportunity.opportunityType);
  return {
    opportunityId: opportunity.opportunityId,
    ifIgnored: {
      estimatedValueLostUSD: round(opportunity.estimatedValue.ifIgnoredUSD),
      creditsForfeitedUSD: opportunity.estimatedValue.valueType === "avoided_loss" ? round(amount) : 0,
      pointsMissed: opportunity.estimatedValue.valueType === "earned" ? Math.round(amount * 100) : 0,
      statusDelayed: statusRelated,
    },
    ifCompleted: {
      estimatedValueGainedUSD: round(opportunity.estimatedValue.ifCompletedUSD),
      projectedRewardsUSD: opportunity.estimatedValue.valueType === "earned" ? round(amount) : 0,
      milestonesUnlocked: statusRelated ? [opportunity.opportunityType] : [],
    },
    deterministicHash: stableId("simulation", [
      opportunity.opportunityId,
      opportunity.estimatedValue.amountUSD,
      opportunity.expirationDate,
    ]),
  };
}

export function generateOpportunityInsights(opportunities: CanonicalOpportunity[]): OpportunityInsight[] {
  if (!opportunities.length) {
    return [{
      insightType: "potential_value_remaining",
      title: "No active opportunities yet",
      summary: "Rewardly will surface wallet opportunities as benefits become available.",
      opportunityIds: [],
      estimatedValueUSD: 0,
    }];
  }
  const highestValue = opportunities.reduce((best, item) =>
    item.estimatedValue.amountUSD > best.estimatedValue.amountUSD ? item : best,
  );
  const mostUrgent = opportunities
    .filter((item) => item.expirationDate)
    .sort((a, b) => String(a.expirationDate).localeCompare(String(b.expirationDate)))[0] || highestValue;
  const total = opportunities.reduce((sum, item) => sum + item.estimatedValue.amountUSD, 0);
  const largestRemaining = opportunities
    .filter((item) => /credit_remaining|unused_.*credit/i.test(item.opportunityType))
    .sort((a, b) => b.estimatedValue.amountUSD - a.estimatedValue.amountUSD)[0];

  return [
    insight("highest_value_opportunity", "Highest value opportunity", highestValue.summary, [highestValue], highestValue.estimatedValue.amountUSD),
    insight("most_urgent_opportunity", "Most urgent opportunity", mostUrgent.summary, [mostUrgent], mostUrgent.estimatedValue.amountUSD),
    insight("potential_value_remaining", "Potential value remaining", `$${money(total)} in wallet value is currently actionable.`, opportunities, total),
    ...(largestRemaining ? [insight("largest_remaining_benefit", "Largest remaining benefit", largestRemaining.summary, [largestRemaining], largestRemaining.estimatedValue.amountUSD)] : []),
  ];
}

export function buildOpportunityReport(context: OpportunityDetectionContext): OpportunityReport {
  const generatedAt = toIso(context.now) || DEFAULT_NOW;
  const opportunities = detectOpportunities(context);
  const timeline = generateOpportunityTimeline(opportunities, context.walletBenefitStates);
  const simulations = opportunities.map(simulateOpportunity);
  const insights = generateOpportunityInsights(opportunities);
  const analytics = opportunities.map((opportunity) =>
    createOpportunityAnalyticsEvent({
      eventType: "opportunity_created",
      userId: context.userId,
      opportunityId: opportunity.opportunityId,
      amountUSD: opportunity.estimatedValue.amountUSD,
      createdAt: generatedAt,
    }),
  );
  return {
    userId: context.userId,
    generatedAt,
    opportunities,
    timeline,
    simulations,
    insights,
    analytics,
    totals: {
      activeCount: opportunities.filter((item) => item.status === "active").length,
      estimatedValueRemainingUSD: round(opportunities.reduce((sum, item) => sum + item.estimatedValue.amountUSD, 0)),
      estimatedValueAtRiskUSD: round(simulations.reduce((sum, item) => sum + item.ifIgnored.estimatedValueLostUSD, 0)),
    },
  };
}

export function createOpportunityAnalyticsEvent(input: {
  eventType: OpportunityAnalyticsEvent["eventType"];
  userId: string;
  opportunityId?: string | null;
  amountUSD?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): OpportunityAnalyticsEvent {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    eventId: stableId("opportunity-event", [
      input.eventType,
      input.userId,
      input.opportunityId,
      createdAt,
    ]),
    eventType: input.eventType,
    userId: input.userId,
    opportunityId: input.opportunityId || null,
    amountUSD: typeof input.amountUSD === "number" ? round(input.amountUSD) : null,
    metadata: input.metadata || {},
    createdAt,
  };
}

export function attachOpportunitiesToDecisionPresentation(input: {
  presentation: { opportunitySummary?: { benefits: string[]; savingsCue: string | null; headline: string } };
  opportunities: CanonicalOpportunity[];
}) {
  const top = input.opportunities.slice(0, 2);
  const benefitLabels = [
    ...(input.presentation.opportunitySummary?.benefits || []),
    ...top.map((opportunity) => opportunity.title),
  ].filter(Boolean);
  return {
    ...input.presentation,
    opportunitySummary: {
      headline: top.length ? "What to know next" : input.presentation.opportunitySummary?.headline || "What you unlock",
      benefits: Array.from(new Set(benefitLabels)).slice(0, 4),
      savingsCue:
        top[0]?.estimatedValue.amountUSD
          ? `$${money(top[0].estimatedValue.amountUSD)} opportunity`
          : input.presentation.opportunitySummary?.savingsCue || null,
    },
  };
}

export function opportunityFixtureStates(userId = "opportunity-user"): CanonicalWalletBenefitState[] {
  return [
    walletState({
      userId,
      cardSlug: "amex-gold",
      benefitId: "amex-gold:dining-credit",
      remainingValue: 14,
      cycleValueLimit: 14,
      cycleFrequency: "monthly",
      cycleEndsAt: "2026-07-31T23:59:59.000Z",
      resetDate: "2026-08-01T00:00:00.000Z",
      confidence: 0.92,
    }),
    walletState({
      userId,
      cardSlug: "amex-platinum",
      benefitId: "amex-platinum:travel-credit",
      remainingValue: 180,
      cycleValueLimit: 200,
      cycleFrequency: "annual",
      cycleEndsAt: "2026-12-31T23:59:59.000Z",
      resetDate: "2027-01-01T00:00:00.000Z",
      confidence: 0.88,
    }),
    walletState({
      userId,
      cardSlug: "discover-it",
      benefitId: "discover-it:quarterly-category",
      remainingSpendCap: 250,
      currentSpend: 1250,
      cycleSpendLimit: 1500,
      cycleFrequency: "quarterly",
      cycleEndsAt: "2026-07-30T23:59:59.000Z",
      confidence: 0.82,
    }),
    walletState({
      userId,
      cardSlug: "amex-platinum",
      benefitId: "amex-platinum:priority-pass-lounge-access",
      remainingUses: 4,
      cycleFrequency: "annual",
      expirationDate: "2026-08-15T00:00:00.000Z",
      confidence: 0.84,
    }),
  ];
}

function opportunitiesFromDecisionContext(context: {
  userId: string;
  decision?: PaymentDecision | null;
  now: Date;
}): CanonicalOpportunity[] {
  const decision = context.decision;
  if (!decision?.recommendedCard || !decision.unlockedBenefits?.length) return [];
  const recommendedCard = decision.recommendedCard;
  return decision.unlockedBenefits
    .filter((match) => /credit/i.test(`${match.summary} ${match.benefit?.label}`))
    .slice(0, 1)
    .map((match) =>
      opportunity({
        userId: context.userId,
        opportunityType: typeForLabel(match.summary || match.benefit.label),
        title: `${match.benefit.label} available at checkout`,
        summary: `This purchase may help use ${match.benefit.label}.`,
        recommendation: "Pay with the recommended card only if this purchase already makes sense.",
        actionRequired: match.requirement || "Pay with the recommended card.",
        amountUSD: Number(match.benefit.amountUSD || 0),
        expirationDate: null,
        confidence: 0.78,
        now: context.now,
        evidence: [{
          type: "recommendation",
          label: "Checkout recommendation",
          value: recommendedCard.card.slug,
          confidence: 0.78,
        }],
        valueType: "unlocked",
      }),
    );
}

function opportunityFromState(input: {
  state: CanonicalWalletBenefitState;
  now: Date;
  opportunityType: OpportunityType;
  title: string;
  summary: string;
  recommendation: string;
  actionRequired: string;
  valueType: CanonicalOpportunity["estimatedValue"]["valueType"];
}) {
  const amount = estimateStateValue(input.state);
  return opportunity({
    userId: input.state.userId,
    opportunityType: input.opportunityType,
    title: input.title,
    summary: input.summary,
    recommendation: input.recommendation,
    actionRequired: input.actionRequired,
    amountUSD: amount,
    expirationDate: input.state.expirationDate || input.state.cycleEndsAt || input.state.resetDate,
    confidence: input.state.confidence,
    now: input.now,
    valueType: input.valueType,
    evidence: [
      {
        type: "wallet_state",
        label: "Wallet benefit state",
        value: input.state.walletBenefitStateId,
        confidence: input.state.confidence,
      },
      {
        type: "estimate",
        label: "Estimated value",
        value: amount,
        confidence: Math.min(0.95, input.state.confidence),
      },
    ],
  });
}

function opportunity(input: {
  userId: string;
  opportunityType: OpportunityType;
  title: string;
  summary: string;
  recommendation: string;
  actionRequired: string;
  amountUSD: number;
  expirationDate: string | null;
  confidence: number;
  now: Date;
  evidence: OpportunityEvidence[];
  valueType: CanonicalOpportunity["estimatedValue"]["valueType"];
}): CanonicalOpportunity {
  const createdAt = input.now.toISOString();
  const amount = round(Math.max(0, input.amountUSD));
  return {
    opportunityId: stableId("opportunity", [
      input.userId,
      input.opportunityType,
      input.title,
      input.expirationDate,
    ]),
    userId: input.userId,
    opportunityType: input.opportunityType,
    priority: priorityFor(input.confidence, amount, input.expirationDate, input.now),
    estimatedValue: {
      amountUSD: amount,
      valueType: input.valueType,
      ifIgnoredUSD: input.valueType === "avoided_loss" ? amount : round(amount * 0.5),
      ifCompletedUSD: amount,
    },
    expirationDate: input.expirationDate,
    confidence: round(input.confidence),
    title: input.title,
    summary: input.summary,
    recommendation: input.recommendation,
    supportingEvidence: input.evidence,
    actionRequired: input.actionRequired,
    status: input.expirationDate && daysUntil(input.expirationDate, input.now) < 0 ? "expired" : "active",
    createdAt,
    updatedAt: createdAt,
  };
}

function walletState(input: Partial<CanonicalWalletBenefitState> & { userId: string; cardSlug: string; benefitId: string }): CanonicalWalletBenefitState {
  const now = DEFAULT_NOW;
  return {
    walletBenefitStateId: stableId("wallet-state", [input.userId, input.cardSlug, input.benefitId]),
    userId: input.userId,
    cardId: input.cardSlug,
    cardSlug: input.cardSlug,
    benefitId: input.benefitId,
    issuer: input.issuer || null,
    status: input.status || "active",
    enrollmentStatus: input.enrollmentStatus || "not_required",
    activationStatus: input.activationStatus || "not_required",
    benefitState: input.benefitState || input.status || "active",
    remainingValue: input.remainingValue ?? null,
    remainingSpendCap: input.remainingSpendCap ?? null,
    remainingUses: input.remainingUses ?? null,
    cycleValueLimit: input.cycleValueLimit ?? null,
    cycleSpendLimit: input.cycleSpendLimit ?? null,
    cycleUsageLimit: input.cycleUsageLimit ?? null,
    cycleFrequency: input.cycleFrequency || "none",
    cycleStartsAt: input.cycleStartsAt || null,
    cycleEndsAt: input.cycleEndsAt || null,
    currentSpend: input.currentSpend || 0,
    benefitUsageCount: input.benefitUsageCount || 0,
    currentCycle: input.currentCycle || null,
    historicalCycles: input.historicalCycles || [],
    lastUsed: input.lastUsed || null,
    effectiveDate: input.effectiveDate || null,
    resetDate: input.resetDate || null,
    expirationDate: input.expirationDate || null,
    lastObserved: input.lastObserved || now,
    lastVerified: input.lastVerified || null,
    confidence: input.confidence ?? 0.7,
    confidenceSource: input.confidenceSource || "estimated",
    notes: input.notes || [],
    legacyBenefitAliases: input.legacyBenefitAliases || [],
    ambiguousLegacyMapping: input.ambiguousLegacyMapping || false,
    version: input.version || 1,
    events: input.events || [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function typeForCreditState(state: CanonicalWalletBenefitState, fallback: OpportunityType): OpportunityType {
  const label = state.benefitId.toLowerCase();
  if (label.includes("dining")) return "dining_credit_remaining";
  if (label.includes("streaming")) return "streaming_credit_remaining";
  if (label.includes("shopping") || label.includes("saks") || label.includes("lululemon")) return "shopping_credit_remaining";
  if (label.includes("travel") || label.includes("airline")) return "travel_credit_remaining";
  return fallback;
}

function typeForLabel(label: string): OpportunityType {
  const normalized = label.toLowerCase();
  if (normalized.includes("dining")) return "dining_credit_remaining";
  if (normalized.includes("streaming")) return "streaming_credit_remaining";
  if (normalized.includes("travel") || normalized.includes("airline")) return "travel_credit_remaining";
  if (normalized.includes("shopping") || normalized.includes("saks") || normalized.includes("lululemon")) return "shopping_credit_remaining";
  return "unused_monthly_credit";
}

function milestoneTypeFromState(state: CanonicalWalletBenefitState): OpportunityType {
  const label = state.benefitId.toLowerCase();
  if (label.includes("welcome")) return "welcome_bonus_progress";
  if (label.includes("companion")) return "companion_pass_progress";
  if (label.includes("free-night")) return "free_night_progress";
  if (label.includes("elite")) return "elite_status_progress";
  return "spend_threshold_progress";
}

function estimateStateValue(state: CanonicalWalletBenefitState) {
  if (typeof state.remainingValue === "number") return state.remainingValue;
  if (typeof state.remainingSpendCap === "number") return Math.min(50, state.remainingSpendCap * 0.03);
  if (typeof state.remainingUses === "number") return state.remainingUses * 15;
  return 0;
}

function opportunityScore(opportunity: CanonicalOpportunity) {
  const valueScore = Math.min(60, opportunity.estimatedValue.amountUSD);
  const urgencyScore = opportunity.expirationDate
    ? Math.max(0, 30 - daysUntil(opportunity.expirationDate, new Date(DEFAULT_NOW)))
    : 0;
  const confidenceScore = opportunity.confidence * 20;
  const priorityBoost = { critical: 30, high: 20, medium: 10, low: 0 }[opportunity.priority];
  return valueScore + urgencyScore + confidenceScore + priorityBoost;
}

function priorityFor(confidence: number, amount: number, expirationDate: string | null, now: Date): OpportunityPriority {
  const days = daysUntil(expirationDate, now);
  if (amount >= 100 || (days >= 0 && days <= 7 && amount >= 10)) return "critical";
  if (amount >= 40 || (days >= 0 && days <= 14)) return "high";
  if (amount >= 10 || confidence >= 0.75) return "medium";
  return "low";
}

function downgradePriority(priority: OpportunityPriority): OpportunityPriority {
  if (priority === "critical") return "high";
  if (priority === "high") return "medium";
  if (priority === "medium") return "low";
  return "low";
}

function eventTypeForOpportunity(type: OpportunityType): OpportunityTimelineItem["eventType"] {
  if (type === "quarterly_category_ending") return "quarterly_category_change";
  if (type === "benefit_expiring_soon") return "benefit_expiration";
  if (type.includes("annual") || type === "travel_credit_remaining") return "annual_renewal";
  if (type.includes("welcome")) return "welcome_bonus_deadline";
  return "monthly_reset";
}

function timelineItem(input: Omit<OpportunityTimelineItem, "timelineId">): OpportunityTimelineItem {
  return {
    timelineId: stableId("timeline", [input.date, input.eventType, input.title, input.opportunityId]),
    ...input,
  };
}

function titleForCredit(state: CanonicalWalletBenefitState) {
  return `${labelFromBenefitId(state.benefitId)} remaining`;
}

function labelFromBenefitId(benefitId: string) {
  const last = benefitId.split(":").pop() || benefitId;
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actionForState(state: CanonicalWalletBenefitState) {
  if (state.enrollmentStatus === "required" || state.enrollmentStatus === "not_enrolled") return "Enroll before using this benefit.";
  if (state.activationStatus === "required" || state.activationStatus === "not_activated") return "Activate this benefit before relying on it.";
  return "Use the eligible card before the benefit resets or expires.";
}

function hasRemainingValue(state: CanonicalWalletBenefitState) {
  return typeof state.remainingValue === "number" && state.remainingValue > 0;
}

function isExpired(state: CanonicalWalletBenefitState, now: Date) {
  return daysUntil(state.expirationDate, now) < 0 || state.status === "expired";
}

function daysUntil(date: string | null | undefined, now: Date) {
  if (!date) return Number.POSITIVE_INFINITY;
  const target = new Date(date).getTime();
  if (!Number.isFinite(target)) return Number.POSITIVE_INFINITY;
  return Math.ceil((target - now.getTime()) / (24 * 60 * 60 * 1000));
}

function insight(
  insightType: OpportunityInsight["insightType"],
  title: string,
  summary: string,
  opportunities: CanonicalOpportunity[],
  value: number,
): OpportunityInsight {
  return {
    insightType,
    title,
    summary,
    opportunityIds: opportunities.map((opportunityItem) => opportunityItem.opportunityId),
    estimatedValueUSD: round(value),
  };
}

function money(value: number | null | undefined) {
  return round(Number(value || 0)).toFixed(2).replace(/\.00$/, "");
}

function toIso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function stableId(prefix: string, parts: Array<unknown>) {
  const seed = parts.map((part) => String(part || "")).join("|");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `${prefix}_${hash.toString(16)}`;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
