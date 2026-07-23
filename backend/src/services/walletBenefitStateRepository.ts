import {
  recordWalletBenefitEvent,
  resetWalletBenefitCycle,
  type CanonicalWalletBenefitState,
  type WalletBenefitEvent,
} from "./walletIntelligenceService";

export class WalletBenefitStateVersionError extends Error {
  constructor(message = "Wallet benefit state version conflict") {
    super(message);
    this.name = "WalletBenefitStateVersionError";
  }
}

export class WalletBenefitStateDuplicateEventError extends Error {
  constructor(message = "Wallet benefit usage event already applied") {
    super(message);
    this.name = "WalletBenefitStateDuplicateEventError";
  }
}

export interface WalletBenefitStateRepository {
  getState(userId: string, benefitId: string): Promise<CanonicalWalletBenefitState | null>;
  listStates(userId: string): Promise<CanonicalWalletBenefitState[]>;
  saveState(
    state: CanonicalWalletBenefitState,
    options?: { expectedVersion?: number },
  ): Promise<CanonicalWalletBenefitState>;
  appendEvent(
    stateId: string,
    event: Omit<WalletBenefitEvent, "eventId" | "walletBenefitStateId" | "userId" | "benefitId">,
    options?: { expectedVersion?: number },
  ): Promise<CanonicalWalletBenefitState>;
  applyUsageUpdate(
    stateId: string,
    updater: (state: CanonicalWalletBenefitState) => CanonicalWalletBenefitState,
    options?: { expectedVersion?: number; idempotencyKey?: string },
  ): Promise<CanonicalWalletBenefitState>;
  resetCycle(
    stateId: string,
    resetAt?: string,
    options?: { expectedVersion?: number },
  ): Promise<CanonicalWalletBenefitState>;
}

export class InMemoryWalletBenefitStateRepository implements WalletBenefitStateRepository {
  private states = new Map<string, CanonicalWalletBenefitState>();
  private idempotencyKeys = new Set<string>();

  constructor(states: CanonicalWalletBenefitState[] = []) {
    states.forEach((state) => this.states.set(state.walletBenefitStateId, cloneState(state)));
  }

  async getState(userId: string, benefitId: string) {
    const normalizedBenefitId = normalize(benefitId);
    const state =
      Array.from(this.states.values()).find(
        (candidate) =>
          candidate.userId === userId &&
          (normalize(candidate.benefitId) === normalizedBenefitId ||
            normalize(`${candidate.cardSlug}:${candidate.benefitId}`) === normalizedBenefitId),
      ) || null;
    return state ? cloneState(state) : null;
  }

  async listStates(userId: string) {
    return Array.from(this.states.values())
      .filter((state) => state.userId === userId)
      .map(cloneState);
  }

  async saveState(
    state: CanonicalWalletBenefitState,
    options: { expectedVersion?: number } = {},
  ) {
    this.assertVersion(state.walletBenefitStateId, options.expectedVersion);
    const next = { ...cloneState(state), version: state.version + 1 };
    this.states.set(next.walletBenefitStateId, next);
    return cloneState(next);
  }

  async appendEvent(
    stateId: string,
    event: Omit<WalletBenefitEvent, "eventId" | "walletBenefitStateId" | "userId" | "benefitId">,
    options: { expectedVersion?: number } = {},
  ) {
    const current = this.requireState(stateId);
    this.assertVersion(stateId, options.expectedVersion);
    const next = recordWalletBenefitEvent(current, event);
    const saved = { ...next, version: current.version + 1 };
    this.states.set(stateId, saved);
    return cloneState(saved);
  }

  async applyUsageUpdate(
    stateId: string,
    updater: (state: CanonicalWalletBenefitState) => CanonicalWalletBenefitState,
    options: { expectedVersion?: number; idempotencyKey?: string } = {},
  ) {
    const current = this.requireState(stateId);
    this.assertVersion(stateId, options.expectedVersion);
    if (options.idempotencyKey) {
      const key = `${stateId}:${options.idempotencyKey}`;
      if (this.idempotencyKeys.has(key)) {
        throw new WalletBenefitStateDuplicateEventError();
      }
      this.idempotencyKeys.add(key);
    }
    const next = { ...updater(cloneState(current)), version: current.version + 1 };
    this.states.set(stateId, cloneState(next));
    return cloneState(next);
  }

  async resetCycle(
    stateId: string,
    resetAt?: string,
    options: { expectedVersion?: number } = {},
  ) {
    const current = this.requireState(stateId);
    this.assertVersion(stateId, options.expectedVersion);
    const next = resetWalletBenefitCycle(current, resetAt);
    const saved = next === current ? current : { ...next, version: current.version + 1 };
    this.states.set(stateId, saved);
    return cloneState(saved);
  }

  private requireState(stateId: string) {
    const state = this.states.get(stateId);
    if (!state) throw new Error(`Wallet benefit state not found: ${stateId}`);
    return cloneState(state);
  }

  private assertVersion(stateId: string, expectedVersion?: number) {
    if (typeof expectedVersion !== "number") return;
    const current = this.states.get(stateId);
    if (!current || current.version !== expectedVersion) {
      throw new WalletBenefitStateVersionError();
    }
  }
}

function cloneState(state: CanonicalWalletBenefitState): CanonicalWalletBenefitState {
  return JSON.parse(JSON.stringify(state));
}

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
