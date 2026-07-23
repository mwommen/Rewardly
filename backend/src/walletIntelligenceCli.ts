import {
  auditWalletBenefitStates,
  WALLET_SYNC_PROVIDER_INTERFACES,
} from "./services/walletIntelligenceService";
import { InMemoryWalletBenefitStateRepository } from "./services/walletBenefitStateRepository";
import {
  walletIntelligenceFixtureStates,
  walletResetDemoState,
} from "./services/walletIntelligenceFixture";
import { WalletUsageMutationService } from "./services/walletUsageMutationService";

const command = process.argv[2] || "help";

async function run() {
  const states = walletIntelligenceFixtureStates();
  if (command === "audit") {
    print(auditWalletBenefitStates(states));
    return;
  }
  if (command === "benefits") {
    print({ states, providers: WALLET_SYNC_PROVIDER_INTERFACES });
    return;
  }
  if (command === "usage") {
    print(
      states.map((state) => ({
        benefitId: state.benefitId,
        status: state.status,
        remainingValue: state.remainingValue,
        remainingSpendCap: state.remainingSpendCap,
        remainingUses: state.remainingUses,
        cycleValueLimit: state.cycleValueLimit,
        cycleSpendLimit: state.cycleSpendLimit,
        cycleUsageLimit: state.cycleUsageLimit,
        cycleFrequency: state.cycleFrequency,
        cycleStartsAt: state.cycleStartsAt,
        cycleEndsAt: state.cycleEndsAt,
        currentSpend: state.currentSpend,
        benefitUsageCount: state.benefitUsageCount,
        resetDate: state.resetDate,
        currentCycle: state.currentCycle,
        historicalCycles: state.historicalCycles,
      })),
    );
    return;
  }
  if (command === "confidence") {
    print(
      states.map((state) => ({
        benefitId: state.benefitId,
        confidence: state.confidence,
        confidenceSource: state.confidenceSource,
        lastObserved: state.lastObserved,
        lastVerified: state.lastVerified,
      })),
    );
    return;
  }
  if (command === "reset-demo") {
    const first = walletResetDemoState();
    const second = walletResetDemoState(first);
    print({ firstReset: first, repeatedResetIsIdempotent: JSON.stringify(first) === JSON.stringify(second) });
    return;
  }
  if (command === "simulate-usage") {
    const repository = new InMemoryWalletBenefitStateRepository(states);
    const service = new WalletUsageMutationService(repository);
    const state = states.find((candidate) => candidate.remainingValue && candidate.remainingValue > 0);
    if (!state) throw new Error("No usage fixture found");
    const updated = await service.recordUsage({
      stateId: state.walletBenefitStateId,
      occurredAt: "2026-07-22T12:00:00.000Z",
      idempotencyKey: "demo-usage-1",
      valueUsed: 3,
      spendUsed: 3,
      usesUsed: 1,
      source: "user_verified",
      notes: "CLI simulated usage",
    });
    print({ before: state, after: updated });
    return;
  }
  print({
    usage:
      "ts-node src/walletIntelligenceCli.ts audit|benefits|usage|confidence|reset-demo|simulate-usage",
  });
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
