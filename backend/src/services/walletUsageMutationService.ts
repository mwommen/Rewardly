import {
  canonicalizeWalletBenefitState,
  recordWalletBenefitEvent,
  type CanonicalWalletBenefitState,
  type WalletStateConfidenceSource,
} from "./walletIntelligenceService";
import type { WalletBenefitStateRepository } from "./walletBenefitStateRepository";

export type WalletUsageMutationInput = {
  stateId: string;
  occurredAt: string;
  idempotencyKey: string;
  valueUsed?: number;
  spendUsed?: number;
  usesUsed?: number;
  source?: WalletStateConfidenceSource;
  notes?: string;
};

export class WalletUsageMutationService {
  constructor(private readonly repository: WalletBenefitStateRepository) {}

  async recordUsage(input: WalletUsageMutationInput) {
    validateUsageInput(input);
    return this.repository.applyUsageUpdate(
      input.stateId,
      (state) => applyUsageToState(state, input),
      {
        expectedVersion: undefined,
        idempotencyKey: input.idempotencyKey,
      },
    );
  }
}

export function applyUsageToState(
  state: CanonicalWalletBenefitState,
  input: WalletUsageMutationInput,
): CanonicalWalletBenefitState {
  validateUsageInput(input);
  const valueUsed = input.valueUsed || 0;
  const spendUsed = input.spendUsed || 0;
  const usesUsed = input.usesUsed || 0;
  const nextRemainingValue =
    state.remainingValue === null ? null : Math.max(0, state.remainingValue - valueUsed);
  const nextRemainingSpendCap =
    state.remainingSpendCap === null
      ? null
      : Math.max(0, state.remainingSpendCap - spendUsed);
  const nextRemainingUses =
    state.remainingUses === null
      ? null
      : Math.max(0, state.remainingUses - usesUsed);

  const rawNext = {
    ...state,
    remainingValue: nextRemainingValue,
    remainingSpendCap: nextRemainingSpendCap,
    remainingUses: nextRemainingUses,
    currentSpend: state.currentSpend + spendUsed,
    benefitUsageCount: state.benefitUsageCount + usesUsed,
    lastUsed: input.occurredAt,
    updatedAt: input.occurredAt,
    events: state.events,
  };
  const canonical = canonicalizeWalletBenefitState(rawNext);
  return recordWalletBenefitEvent(canonical, {
    eventType:
      canonical.status === "exhausted" ? "credit_exhausted" : "usage_recorded",
    occurredAt: input.occurredAt,
    valueDelta: valueUsed ? -valueUsed : null,
    spendDelta: spendUsed ? -spendUsed : null,
    usesDelta: usesUsed ? -usesUsed : null,
    idempotencyKey: input.idempotencyKey,
    source: input.source || state.confidenceSource,
    notes: input.notes || null,
  });
}

function validateUsageInput(input: WalletUsageMutationInput) {
  if (!input.stateId) throw new Error("stateId is required");
  if (!input.occurredAt || Number.isNaN(new Date(input.occurredAt).getTime())) {
    throw new Error("occurredAt must be a valid ISO timestamp");
  }
  if (!input.idempotencyKey) throw new Error("idempotencyKey is required");
  for (const [field, value] of [
    ["valueUsed", input.valueUsed],
    ["spendUsed", input.spendUsed],
    ["usesUsed", input.usesUsed],
  ] as const) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${field} must be a non-negative number`);
    }
  }
}
