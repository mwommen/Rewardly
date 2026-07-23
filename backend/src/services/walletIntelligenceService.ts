import type { CanonicalBenefitRecord } from "./benefitIntelligenceService";

export type WalletBenefitLifecycleState =
  | "unknown"
  | "available"
  | "enrollment_required"
  | "activation_required"
  | "active"
  | "partially_used"
  | "exhausted"
  | "expired"
  | "disabled"
  | "removed"
  | "suspended";

export type WalletEnrollmentStatus = "unknown" | "not_required" | "required" | "enrolled" | "not_enrolled";
export type WalletActivationStatus = "unknown" | "not_required" | "required" | "activated" | "not_activated";
export type WalletStateConfidenceSource = "issuer_verified" | "user_verified" | "imported" | "estimated" | "unknown";
export type WalletBenefitCycleFrequency = "none" | "monthly" | "quarterly" | "annual" | "usage_count";
export type WalletStateRequirement = "state_not_required" | "state_optional" | "state_required";

export type WalletBenefitCycle = {
  cycleId: string;
  startsAt: string | null;
  endsAt: string | null;
  usedValue: number;
  usedCount: number;
  usedSpend: number;
};

export type WalletBenefitEventType =
  | "benefit_enrolled"
  | "benefit_activated"
  | "credit_used"
  | "credit_exhausted"
  | "cycle_reset"
  | "benefit_expired"
  | "benefit_removed"
  | "benefit_restored"
  | "usage_recorded";

export type WalletBenefitEvent = {
  eventId: string;
  walletBenefitStateId: string;
  userId: string;
  benefitId: string;
  eventType: WalletBenefitEventType;
  occurredAt: string;
  valueDelta?: number | null;
  spendDelta?: number | null;
  usesDelta?: number | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  source: WalletStateConfidenceSource;
};

export type CanonicalWalletBenefitState = {
  walletBenefitStateId: string;
  userId: string;
  cardId: string;
  cardSlug: string;
  benefitId: string;
  issuer: string | null;
  status: WalletBenefitLifecycleState;
  enrollmentStatus: WalletEnrollmentStatus;
  activationStatus: WalletActivationStatus;
  benefitState: WalletBenefitLifecycleState;
  remainingValue: number | null;
  remainingSpendCap: number | null;
  remainingUses: number | null;
  cycleValueLimit: number | null;
  cycleSpendLimit: number | null;
  cycleUsageLimit: number | null;
  cycleFrequency: WalletBenefitCycleFrequency;
  cycleStartsAt: string | null;
  cycleEndsAt: string | null;
  currentSpend: number;
  benefitUsageCount: number;
  currentCycle: string | null;
  historicalCycles: WalletBenefitCycle[];
  lastUsed: string | null;
  effectiveDate: string | null;
  resetDate: string | null;
  expirationDate: string | null;
  lastObserved: string | null;
  lastVerified: string | null;
  confidence: number;
  confidenceSource: WalletStateConfidenceSource;
  notes: string[];
  legacyBenefitAliases: string[];
  ambiguousLegacyMapping: boolean;
  version: number;
  events: WalletBenefitEvent[];
  createdAt: string;
  updatedAt: string;
};

export type WalletSyncProviderType =
  | "issuer_api"
  | "plaid"
  | "user_confirmation"
  | "manual_edit"
  | "receipt_analysis"
  | "email_parsing";

export type WalletBenefitSyncProvider = {
  providerId: string;
  providerType: WalletSyncProviderType;
  displayName: string;
  canVerifyEnrollment: boolean;
  canVerifyActivation: boolean;
  canVerifyUsage: boolean;
  canVerifyResets: boolean;
  enabled: boolean;
};

export type WalletBenefitDecision = {
  eligible: boolean;
  reason:
    | "no_wallet_state"
    | "available"
    | "active"
    | "partially_used"
    | "enrollment_required"
    | "activation_required"
    | "exhausted"
    | "expired"
    | "disabled"
    | "removed"
    | "suspended"
    | "wallet_state_required"
    | "wallet_confidence_too_low"
    | "unknown";
  state: CanonicalWalletBenefitState | null;
  remainingValue: number | null;
  confidence: number;
  explanation: string;
};

export type WalletBenefitUsageEvidence = {
  kind: "spend_cap_split" | "statement_credit_remaining" | "usage_limit";
  purchaseAmount?: number;
  cappedAmount?: number;
  uncappedAmount?: number;
  bonusRate?: number;
  baseRate?: number;
  effectiveRate?: number;
  remainingValue?: number | null;
  remainingSpendCap?: number | null;
  remainingUses?: number | null;
  explanation: string;
};

export const WALLET_SYNC_PROVIDER_INTERFACES: WalletBenefitSyncProvider[] = [
  provider("issuer-api", "issuer_api", "Issuer API", true, true, true, true, false),
  provider("plaid", "plaid", "Plaid", false, false, false, false, false),
  provider("user-confirmation", "user_confirmation", "User Confirmation", true, true, true, false, false),
  provider("manual-edit", "manual_edit", "Manual Edit", true, true, true, true, true),
  provider("receipt-analysis", "receipt_analysis", "Receipt Analysis", false, false, true, false, false),
  provider("email-parsing", "email_parsing", "Email Parsing", false, false, true, true, false),
];

export function canonicalizeWalletBenefitState(input: {
  userId: string;
  cardId?: string | null;
  cardSlug?: string | null;
  benefitId?: string | null;
  issuer?: string | null;
  status?: WalletBenefitLifecycleState | null;
  enrollmentStatus?: WalletEnrollmentStatus | null;
  activationStatus?: WalletActivationStatus | null;
  remainingValue?: number | null;
  remainingSpendCap?: number | null;
  remainingUses?: number | null;
  cycleValueLimit?: number | null;
  cycleSpendLimit?: number | null;
  cycleUsageLimit?: number | null;
  cycleFrequency?: WalletBenefitCycleFrequency | null;
  cycleStartsAt?: string | Date | null;
  cycleEndsAt?: string | Date | null;
  currentSpend?: number | null;
  benefitUsageCount?: number | null;
  currentCycle?: string | null;
  historicalCycles?: WalletBenefitCycle[];
  lastUsed?: string | Date | null;
  effectiveDate?: string | Date | null;
  resetDate?: string | Date | null;
  expirationDate?: string | Date | null;
  lastObserved?: string | Date | null;
  lastVerified?: string | Date | null;
  confidence?: number | null;
  confidenceSource?: WalletStateConfidenceSource | null;
  notes?: string[];
  legacyBenefitAliases?: string[];
  ambiguousLegacyMapping?: boolean | null;
  version?: number | null;
  events?: WalletBenefitEvent[];
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}): CanonicalWalletBenefitState {
  const now = new Date().toISOString();
  const benefitId = String(input.benefitId || "").trim();
  const cardSlug = String(input.cardSlug || input.cardId || "").trim();
  const enrollmentStatus = input.enrollmentStatus || "unknown";
  const activationStatus = input.activationStatus || "unknown";
  const cycleValueLimit = finiteOrNull(input.cycleValueLimit);
  const cycleSpendLimit = finiteOrNull(input.cycleSpendLimit);
  const cycleUsageLimit = finiteOrNull(input.cycleUsageLimit);
  const status = inferLifecycleState({
    requestedStatus: input.status || undefined,
    enrollmentStatus,
    activationStatus,
    remainingValue: input.remainingValue ?? null,
    remainingSpendCap: input.remainingSpendCap ?? null,
    remainingUses: input.remainingUses ?? null,
    cycleValueLimit,
    cycleSpendLimit,
    cycleUsageLimit,
    expirationDate: toIso(input.expirationDate),
  });

  return {
    walletBenefitStateId: walletBenefitStateId(input.userId, cardSlug, benefitId),
    userId: input.userId,
    cardId: String(input.cardId || cardSlug || "unknown-card"),
    cardSlug,
    benefitId,
    issuer: input.issuer || null,
    status,
    enrollmentStatus,
    activationStatus,
    benefitState: status,
    remainingValue: finiteOrNull(input.remainingValue),
    remainingSpendCap: finiteOrNull(input.remainingSpendCap),
    remainingUses: finiteOrNull(input.remainingUses),
    cycleValueLimit,
    cycleSpendLimit,
    cycleUsageLimit,
    cycleFrequency: input.cycleFrequency || "none",
    cycleStartsAt: toIso(input.cycleStartsAt),
    cycleEndsAt: toIso(input.cycleEndsAt),
    currentSpend: finiteOrZero(input.currentSpend),
    benefitUsageCount: Math.max(0, Math.floor(finiteOrZero(input.benefitUsageCount))),
    currentCycle: input.currentCycle || null,
    historicalCycles: input.historicalCycles || [],
    lastUsed: toIso(input.lastUsed),
    effectiveDate: toIso(input.effectiveDate),
    resetDate: toIso(input.resetDate),
    expirationDate: toIso(input.expirationDate),
    lastObserved: toIso(input.lastObserved),
    lastVerified: toIso(input.lastVerified),
    confidence: clamp(input.confidence ?? confidenceForSource(input.confidenceSource || "unknown")),
    confidenceSource: input.confidenceSource || "unknown",
    notes: input.notes || [],
    legacyBenefitAliases: input.legacyBenefitAliases || [],
    ambiguousLegacyMapping: Boolean(input.ambiguousLegacyMapping),
    version: Math.max(0, Math.floor(finiteOrZero(input.version))),
    events: input.events || [],
    createdAt: toIso(input.createdAt) || now,
    updatedAt: toIso(input.updatedAt) || now,
  };
}

export function evaluateWalletBenefitForRecommendation(
  benefit: CanonicalBenefitRecord,
  states: CanonicalWalletBenefitState[] = [],
  options: {
    statePolicy?: "strict_production" | "compatibility";
    minimumConfidence?: number;
  } = {},
): WalletBenefitDecision {
  const state = findWalletStateForBenefit(benefit, states);
  const requirement = walletStateRequirementForBenefit(benefit);
  const statePolicy = options.statePolicy || "strict_production";
  if (!state) {
    if (statePolicy === "strict_production" && requirement === "state_required") {
      return {
        eligible: false,
        reason: "wallet_state_required",
        state: null,
        remainingValue: null,
        confidence: 0,
        explanation: "Wallet state is required before this benefit can be scored.",
      };
    }
    return {
      eligible: true,
      reason: "no_wallet_state",
      state: null,
      remainingValue: benefit.statementCredit?.amountUSD ?? null,
      confidence: 0.45,
      explanation: "No wallet usage state is known for this benefit.",
    };
  }

  if (state.status === "expired" || isExpired(state.expirationDate)) {
    return decision(false, "expired", state, "This benefit has expired.");
  }
  if (["disabled", "removed", "suspended"].includes(state.status)) {
    return decision(false, state.status as WalletBenefitDecision["reason"], state, `This benefit is ${state.status}.`);
  }
  if (state.enrollmentStatus === "required" || state.enrollmentStatus === "not_enrolled") {
    return decision(false, "enrollment_required", state, "Enrollment is required before this benefit can apply.");
  }
  if (state.activationStatus === "required" || state.activationStatus === "not_activated") {
    return decision(false, "activation_required", state, "Activation is required before this benefit can apply.");
  }
  if (state.status === "exhausted" || state.remainingValue === 0 || state.remainingSpendCap === 0 || state.remainingUses === 0) {
    return decision(false, "exhausted", state, "This benefit has been fully used for the current cycle.");
  }
  const minimumConfidence =
    options.minimumConfidence ?? (requirement === "state_required" ? 0.5 : 0);
  if (
    statePolicy === "strict_production" &&
    requirement === "state_required" &&
    (state.confidenceSource === "unknown" || state.confidence < minimumConfidence)
  ) {
    return decision(
      false,
      "wallet_confidence_too_low",
      state,
      "Wallet state confidence is too low to score this benefit definitively.",
    );
  }
  if (state.status === "partially_used") {
    return decision(true, "partially_used", state, "This benefit still has value remaining.");
  }
  if (state.status === "active") {
    return decision(true, "active", state, "This benefit is active.");
  }
  if (state.status === "available") {
    return decision(true, "available", state, "This benefit is available.");
  }
  return decision(false, "unknown", state, "Wallet state is too uncertain to use confidently.");
}

export function applyWalletUsageToBenefitValue(
  benefit: CanonicalBenefitRecord,
  states: CanonicalWalletBenefitState[] = [],
  options: {
    statePolicy?: "strict_production" | "compatibility";
    minimumConfidence?: number;
  } = {},
) {
  const walletDecision = evaluateWalletBenefitForRecommendation(benefit, states, options);
  const evidence: WalletBenefitUsageEvidence[] = [];
  if (!walletDecision.eligible) return { benefit, walletDecision, evidence };
  const remaining = walletDecision.remainingValue;
  if (
    remaining === null ||
    !benefit.statementCredit ||
    benefit.statementCredit.amountUSD === null ||
    remaining === benefit.statementCredit.amountUSD
  ) {
    return { benefit, walletDecision, evidence };
  }
  evidence.push({
    kind: "statement_credit_remaining",
    remainingValue: remaining,
    explanation: `Statement credit limited to $${Math.max(0, remaining)} remaining in this cycle.`,
  });
  return {
    walletDecision,
    evidence,
    benefit: {
      ...benefit,
      statementCredit: {
        ...benefit.statementCredit,
        amountUSD: Math.max(0, remaining),
        capPerPeriodUSD:
          benefit.statementCredit.capPerPeriodUSD === null
            ? null
            : Math.max(0, remaining),
      },
      label: benefit.label.replace(/\$\d+(?:\.\d{1,2})?/, `$${Math.max(0, remaining)}`),
    },
  };
}

export function recordWalletBenefitEvent(
  state: CanonicalWalletBenefitState,
  event: Omit<WalletBenefitEvent, "eventId" | "walletBenefitStateId" | "userId" | "benefitId">,
): CanonicalWalletBenefitState {
  const nextEvent: WalletBenefitEvent = {
    ...event,
    eventId: `${state.walletBenefitStateId}:${event.eventType}:${event.occurredAt}`,
    walletBenefitStateId: state.walletBenefitStateId,
    userId: state.userId,
    benefitId: state.benefitId,
  };
  return {
    ...state,
    events: [...state.events, nextEvent],
    updatedAt: event.occurredAt,
  };
}

export function resetWalletBenefitCycle(
  state: CanonicalWalletBenefitState,
  resetAt = new Date().toISOString(),
): CanonicalWalletBenefitState {
  if (
    state.events.some(
      (event) =>
        event.eventType === "cycle_reset" &&
        event.occurredAt === toIso(resetAt),
    )
  ) {
    return state;
  }
  const cycle: WalletBenefitCycle = {
    cycleId: state.currentCycle || `cycle:${state.walletBenefitStateId}`,
    startsAt: state.cycleStartsAt || state.effectiveDate,
    endsAt: state.cycleEndsAt || resetAt,
    usedValue: state.currentSpend,
    usedCount: state.benefitUsageCount,
    usedSpend: state.currentSpend,
  };
  const nextCycle = nextCycleWindow(state.cycleFrequency, resetAt);
  const nextStatus = inferLifecycleState({
    enrollmentStatus: state.enrollmentStatus,
    activationStatus: state.activationStatus,
    remainingValue: state.cycleValueLimit,
    remainingSpendCap: state.cycleSpendLimit,
    remainingUses: state.cycleUsageLimit,
    cycleValueLimit: state.cycleValueLimit,
    cycleSpendLimit: state.cycleSpendLimit,
    cycleUsageLimit: state.cycleUsageLimit,
    expirationDate: state.expirationDate,
  });
  const reset = {
    ...state,
    status: nextStatus,
    benefitState: nextStatus,
    remainingValue: state.cycleValueLimit,
    remainingSpendCap: state.cycleSpendLimit,
    remainingUses: state.cycleUsageLimit,
    currentSpend: 0,
    benefitUsageCount: 0,
    lastUsed: null,
    historicalCycles: [...state.historicalCycles, cycle],
    currentCycle: nextCycle.cycleId || state.currentCycle,
    cycleStartsAt: nextCycle.startsAt || resetAt,
    cycleEndsAt: nextCycle.endsAt,
    resetDate: nextCycle.nextResetAt || state.resetDate,
    version: state.version + 1,
    updatedAt: resetAt,
  };
  return recordWalletBenefitEvent(reset, {
    eventType: "cycle_reset",
    occurredAt: resetAt,
    source: state.confidenceSource,
    notes: "Demo cycle reset",
  });
}

export function auditWalletBenefitStates(states: CanonicalWalletBenefitState[]) {
  const findings = states.flatMap(auditWalletBenefitState);
  return {
    stateCount: states.length,
    active: states.filter((state) => state.status === "active").length,
    enrollmentRequired: states.filter((state) => state.status === "enrollment_required").length,
    activationRequired: states.filter((state) => state.status === "activation_required").length,
    partiallyUsed: states.filter((state) => state.status === "partially_used").length,
    exhausted: states.filter((state) => state.status === "exhausted").length,
    expired: states.filter((state) => state.status === "expired").length,
    unknown: states.filter((state) => state.status === "unknown").length,
    totalRemainingValue: states.reduce((sum, state) => sum + (state.remainingValue || 0), 0),
    findings,
    findingCount: findings.length,
    averageConfidence:
      states.length === 0
        ? 0
        : Math.round(
            (states.reduce((sum, state) => sum + state.confidence, 0) /
              states.length) *
              100,
          ) / 100,
  };
}

export function auditWalletBenefitState(state: CanonicalWalletBenefitState) {
  const findings: Array<{ severity: "error" | "warning"; code: string; benefitId: string; message: string }> = [];
  const push = (severity: "error" | "warning", code: string, message: string) =>
    findings.push({ severity, code, benefitId: state.benefitId, message });

  if (!state.benefitId) push("error", "MISSING_BENEFIT_ID", "Wallet state is missing a canonical benefit ID.");
  if (state.ambiguousLegacyMapping) push("warning", "AMBIGUOUS_LEGACY_MAPPING", "Legacy benefit mapping is ambiguous.");
  for (const [field, value] of [
    ["remainingValue", state.remainingValue],
    ["remainingSpendCap", state.remainingSpendCap],
    ["remainingUses", state.remainingUses],
    ["cycleValueLimit", state.cycleValueLimit],
    ["cycleSpendLimit", state.cycleSpendLimit],
    ["cycleUsageLimit", state.cycleUsageLimit],
  ] as const) {
    if (typeof value === "number" && value < 0) push("error", "NEGATIVE_VALUE", `${field} cannot be negative.`);
  }
  if (state.remainingValue !== null && state.cycleValueLimit !== null && state.remainingValue > state.cycleValueLimit) {
    push("error", "VALUE_EXCEEDS_CYCLE_LIMIT", "Remaining value exceeds the cycle entitlement.");
  }
  if (state.remainingSpendCap !== null && state.cycleSpendLimit !== null && state.remainingSpendCap > state.cycleSpendLimit) {
    push("error", "SPEND_CAP_EXCEEDS_CYCLE_LIMIT", "Remaining spend cap exceeds the cycle entitlement.");
  }
  if (state.remainingUses !== null && state.cycleUsageLimit !== null && state.remainingUses > state.cycleUsageLimit) {
    push("error", "USES_EXCEED_CYCLE_LIMIT", "Remaining uses exceeds the cycle entitlement.");
  }
  if (state.status === "exhausted" && [state.remainingValue, state.remainingSpendCap, state.remainingUses].some((value) => typeof value === "number" && value > 0)) {
    push("warning", "CONTRADICTORY_LIFECYCLE", "State is exhausted but still has remaining entitlement.");
  }
  if (state.status === "partially_used" && [state.remainingValue, state.remainingSpendCap, state.remainingUses].every((value) => value === null || value === 0)) {
    push("warning", "CONTRADICTORY_LIFECYCLE", "State is partially used without remaining entitlement.");
  }
  if ((state.cycleFrequency !== "none" || state.resetDate) && !state.cycleValueLimit && !state.cycleSpendLimit && !state.cycleUsageLimit) {
    push("warning", "MISSING_CYCLE_LIMIT", "Cyclical state is missing cycle limits.");
  }
  if (state.resetDate && new Date(state.resetDate).getTime() < Date.now() && state.status !== "expired") {
    push("warning", "OVERDUE_CYCLE_RESET", "Cycle reset date has passed.");
  }
  if (state.confidenceSource === "unknown" || state.confidence < 0.5) {
    push("warning", "LOW_CONFIDENCE_STATE", "Wallet state confidence is too low for strict definitive scoring.");
  }
  return findings;
}

export function findWalletStateForBenefit(
  benefit: CanonicalBenefitRecord,
  states: CanonicalWalletBenefitState[] = [],
) {
  const ids = new Set([
    benefit.id,
    `${benefit.cardSlug}:${benefit.id}`,
  ].map(normalizeId));
  return (
    states.find(
      (state) =>
        ids.has(normalizeId(state.benefitId)) ||
        ids.has(normalizeId(`${state.cardSlug}:${state.benefitId}`)) ||
        state.legacyBenefitAliases.some((alias) => ids.has(normalizeId(alias))),
    ) || null
  );
}

export function walletStateRequirementForBenefit(
  benefit: CanonicalBenefitRecord,
): WalletStateRequirement {
  if (benefit.sourceKind === "reward_flat") return "state_not_required";
  if (benefit.statementCredit) return "state_required";
  if (benefit.enrollmentRequired || benefit.activationRequired) return "state_required";
  if (benefit.spendingCap) return "state_required";
  if (benefit.sourceKind === "reward_rotating" && benefit.activationRequired) {
    return "state_required";
  }
  if (benefit.benefitType === "reward_multiplier") return "state_optional";
  return "state_optional";
}

function decision(
  eligible: boolean,
  reason: WalletBenefitDecision["reason"],
  state: CanonicalWalletBenefitState,
  explanation: string,
): WalletBenefitDecision {
  return {
    eligible,
    reason,
    state,
    remainingValue: state.remainingValue,
    confidence: state.confidence,
    explanation,
  };
}

function inferLifecycleState(input: {
  requestedStatus?: WalletBenefitLifecycleState;
  enrollmentStatus: WalletEnrollmentStatus;
  activationStatus: WalletActivationStatus;
  remainingValue: number | null;
  remainingSpendCap: number | null;
  remainingUses: number | null;
  cycleValueLimit: number | null;
  cycleSpendLimit: number | null;
  cycleUsageLimit: number | null;
  expirationDate: string | null;
}): WalletBenefitLifecycleState {
  if (input.requestedStatus && ["disabled", "removed", "suspended", "expired"].includes(input.requestedStatus)) {
    return input.requestedStatus;
  }
  if (isExpired(input.expirationDate)) return "expired";
  if (input.enrollmentStatus === "required" || input.enrollmentStatus === "not_enrolled") {
    return "enrollment_required";
  }
  if (input.activationStatus === "required" || input.activationStatus === "not_activated") {
    return "activation_required";
  }
  const tracked = [
    [input.remainingValue, input.cycleValueLimit],
    [input.remainingSpendCap, input.cycleSpendLimit],
    [input.remainingUses, input.cycleUsageLimit],
  ].filter(([remaining, limit]) => typeof remaining === "number" || typeof limit === "number");
  if (tracked.length) {
    const anyExhaustedLimit = tracked.some(
      ([remaining, limit]) => typeof limit === "number" && remaining === 0,
    );
    if (anyExhaustedLimit) return "exhausted";
    const anyPartial = tracked.some(
      ([remaining, limit]) =>
        typeof remaining === "number" &&
        typeof limit === "number" &&
        remaining >= 0 &&
        remaining < limit,
    );
    if (anyPartial) return "partially_used";
    return input.enrollmentStatus === "enrolled" || input.activationStatus === "activated" ? "active" : "available";
  }
  if (input.enrollmentStatus === "enrolled" || input.activationStatus === "activated") {
    return "active";
  }
  if (
    input.remainingValue === 0 ||
    input.remainingSpendCap === 0 ||
    input.remainingUses === 0
  ) {
    return "exhausted";
  }
  if (
    (typeof input.remainingValue === "number" && input.remainingValue > 0) ||
    (typeof input.remainingSpendCap === "number" && input.remainingSpendCap > 0) ||
    (typeof input.remainingUses === "number" && input.remainingUses > 0)
  ) {
    return "partially_used";
  }
  return "available";
}

function confidenceForSource(source: WalletStateConfidenceSource) {
  if (source === "issuer_verified") return 0.98;
  if (source === "user_verified") return 0.9;
  if (source === "imported") return 0.78;
  if (source === "estimated") return 0.62;
  return 0.4;
}

function provider(
  providerId: string,
  providerType: WalletSyncProviderType,
  displayName: string,
  canVerifyEnrollment: boolean,
  canVerifyActivation: boolean,
  canVerifyUsage: boolean,
  canVerifyResets: boolean,
  enabled: boolean,
): WalletBenefitSyncProvider {
  return {
    providerId,
    providerType,
    displayName,
    canVerifyEnrollment,
    canVerifyActivation,
    canVerifyUsage,
    canVerifyResets,
    enabled,
  };
}

function walletBenefitStateId(userId: string, cardSlug: string, benefitId: string) {
  return [userId, cardSlug, benefitId]
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toIso(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function finiteOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isExpired(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function nextCycleWindow(
  frequency: WalletBenefitCycleFrequency,
  resetAt: string,
): {
  cycleId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  nextResetAt: string | null;
} {
  const start = new Date(resetAt);
  if (Number.isNaN(start.getTime()) || frequency === "none") {
    return { cycleId: null, startsAt: toIso(resetAt), endsAt: null, nextResetAt: null };
  }
  if (frequency === "monthly") {
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59));
    const nextReset = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return {
      cycleId: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      nextResetAt: nextReset.toISOString(),
    };
  }
  if (frequency === "quarterly") {
    const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
    const endMonth = quarter * 3;
    const end = new Date(Date.UTC(start.getUTCFullYear(), endMonth, 0, 23, 59, 59));
    const nextReset = new Date(Date.UTC(start.getUTCFullYear(), endMonth, 1));
    return {
      cycleId: `${start.getUTCFullYear()}-Q${quarter}`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      nextResetAt: nextReset.toISOString(),
    };
  }
  if (frequency === "annual" || frequency === "usage_count") {
    const end = new Date(Date.UTC(start.getUTCFullYear(), 11, 31, 23, 59, 59));
    const nextReset = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
    return {
      cycleId: String(start.getUTCFullYear()),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      nextResetAt: nextReset.toISOString(),
    };
  }
  return { cycleId: null, startsAt: start.toISOString(), endsAt: null, nextResetAt: null };
}
