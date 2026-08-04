import {
  addPaymentJourneyEntry,
  calculateMonthlyProgress,
  createPaymentJourneyEntry,
  filterJourneyEntries,
  reinforcementMessage,
  safeJourneyEntries,
  updateJourneyNotes,
} from "../../mobile/src/utils/paymentJourney";
import type { PaymentDecisionResponse } from "../../mobile/src/types/rewardly";

function decision(
  id: string,
  overrides: Partial<PaymentDecisionResponse> = {},
): PaymentDecisionResponse {
  return {
    decisionId: id,
    status: "recommended",
    recommendedPaymentMethod: {
      cardId: "freedom-flex",
      displayName: "Freedom Flex",
    },
    reason: "Highest verified value.",
    estimatedValue: 4.28,
    currency: "USD",
    confidence: 0.96,
    explanation: {
      summary: "Freedom Flex earns the highest verified rewards for this purchase.",
      factors: ["Category match", "Highest estimated value"],
    },
    ...overrides,
  };
}

describe("mobile payment journey domain", () => {
  test("creates completed payment entries from API decisions", () => {
    const entry = createPaymentJourneyEntry({
      decision: decision("decision-1"),
      merchant: "Target",
      amount: 84.12,
      now: new Date("2026-08-01T12:00:00.000Z"),
    });

    expect(entry).toEqual(
      expect.objectContaining({
        paymentId: "payment-decision-1",
        decisionId: "decision-1",
        merchant: "Target",
        purchaseAmount: 84.12,
        selectedCard: "Freedom Flex",
        estimatedRewardValue: 4.28,
        confidence: 0.96,
        completionTimestamp: "2026-08-01T12:00:00.000Z",
        syncStatus: "local",
        schemaVersion: 1,
      }),
    );
  });

  test("prevents duplicate entries and maintains chronological ordering", () => {
    const first = createPaymentJourneyEntry({
      decision: decision("decision-1"),
      merchant: "Target",
      amount: 84.12,
      now: new Date("2026-08-01T12:00:00.000Z"),
    });
    const newer = createPaymentJourneyEntry({
      decision: decision("decision-2"),
      merchant: "Starbucks",
      amount: 9.5,
      now: new Date("2026-08-02T12:00:00.000Z"),
    });
    const duplicate = createPaymentJourneyEntry({
      decision: decision("decision-1"),
      merchant: "Target",
      amount: 90,
      now: new Date("2026-08-03T12:00:00.000Z"),
    });

    const entries = addPaymentJourneyEntry(
      addPaymentJourneyEntry(addPaymentJourneyEntry([], first), newer),
      duplicate,
    );

    expect(entries.map((entry) => entry.decisionId)).toEqual([
      "decision-1",
      "decision-2",
    ]);
    expect(entries[0].purchaseAmount).toBe(90);
  });

  test("filters timeline entries for week, month, and all time", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const entries = [
      createPaymentJourneyEntry({
        decision: decision("old"),
        merchant: "Old",
        amount: 1,
        now: new Date("2026-07-20T12:00:00.000Z"),
      }),
      createPaymentJourneyEntry({
        decision: decision("month"),
        merchant: "Month",
        amount: 2,
        now: new Date("2026-08-02T12:00:00.000Z"),
      }),
      createPaymentJourneyEntry({
        decision: decision("week"),
        merchant: "Week",
        amount: 3,
        now: new Date("2026-08-14T12:00:00.000Z"),
      }),
    ];

    expect(filterJourneyEntries(entries, "week", now).map((entry) => entry.decisionId)).toEqual(["week"]);
    expect(filterJourneyEntries(entries, "month", now).map((entry) => entry.decisionId)).toEqual(["week", "month"]);
    expect(filterJourneyEntries(entries, "all", now).map((entry) => entry.decisionId)).toEqual(["week", "month", "old"]);
  });

  test("calculates monthly progress from completed payments", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const entries = [
      createPaymentJourneyEntry({
        decision: decision("target-1", { estimatedValue: 4, confidence: 0.9 }),
        merchant: "Target",
        amount: 100,
        now: new Date("2026-08-01T12:00:00.000Z"),
      }),
      createPaymentJourneyEntry({
        decision: decision("target-2", { estimatedValue: 6, confidence: 1 }),
        merchant: "Target",
        amount: 150,
        now: new Date("2026-08-03T12:00:00.000Z"),
      }),
    ];

    expect(calculateMonthlyProgress(entries, now)).toEqual({
      smartPayments: 2,
      estimatedRewards: 10,
      averageConfidence: 0.95,
      bestMerchant: "Target",
      mostUsedCard: "Freedom Flex",
    });
  });

  test("updates notes and recovers gracefully from corrupted storage values", () => {
    const entry = createPaymentJourneyEntry({
      decision: decision("decision-1"),
      merchant: "Target",
      amount: 84.12,
    });

    expect(updateJourneyNotes([entry], entry.paymentId, "  Used self checkout  ")[0].userNotes).toBe("Used self checkout");
    expect(safeJourneyEntries(null)).toEqual([]);
    expect(safeJourneyEntries([{ broken: true }, entry])).toEqual([entry]);
  });

  test("creates reinforcement messages from existing recommendation data", () => {
    const protectedEntry = createPaymentJourneyEntry({
      decision: decision("protected", {
        explanation: {
          summary: "This purchase may include purchase protection.",
          factors: [],
        },
      }),
      merchant: "Best Buy",
      amount: 200,
    });

    expect(reinforcementMessage(protectedEntry)).toMatch(/protection/i);
  });
});
