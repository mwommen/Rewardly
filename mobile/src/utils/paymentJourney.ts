import type {
  MonthlyProgress,
  PaymentJourneyEntry,
  PaymentJourneyFilter
} from "../types/paymentJourney";
import type { PaymentDecisionResponse } from "../types/rewardly";

export function createPaymentJourneyEntry({
  decision,
  merchant,
  amount,
  selectedCard,
  now = new Date()
}: {
  decision: PaymentDecisionResponse;
  merchant: string;
  amount: number;
  selectedCard?: string;
  now?: Date;
}): PaymentJourneyEntry {
  const recommendedCard =
    decision.recommendedPaymentMethod?.displayName || "No card selected";
  const timestamp = now.toISOString();
  return {
    paymentId: `payment-${decision.decisionId}`,
    decisionId: decision.decisionId,
    merchant,
    purchaseAmount: amount,
    currency: decision.currency,
    recommendedCard,
    selectedCard: selectedCard || recommendedCard,
    estimatedRewardValue: decision.estimatedValue,
    confidence: decision.confidence,
    recommendationExplanation: decision.explanation,
    purchaseTimestamp: timestamp,
    completionTimestamp: timestamp,
    syncStatus: "local",
    schemaVersion: 1
  };
}

export function addPaymentJourneyEntry(
  entries: PaymentJourneyEntry[],
  entry: PaymentJourneyEntry
) {
  const existing = entries.filter((item) => item.decisionId !== entry.decisionId);
  return sortJourneyEntries([entry, ...existing]);
}

export function sortJourneyEntries(entries: PaymentJourneyEntry[]) {
  return [...entries].sort(
    (a, b) =>
      new Date(b.completionTimestamp).getTime() -
      new Date(a.completionTimestamp).getTime()
  );
}

export function filterJourneyEntries(
  entries: PaymentJourneyEntry[],
  filter: PaymentJourneyFilter,
  now = new Date()
) {
  if (filter === "all") return sortJourneyEntries(entries);
  const start = new Date(now);
  if (filter === "week") {
    start.setUTCDate(start.getUTCDate() - 7);
  } else {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
  }
  return sortJourneyEntries(
    entries.filter((entry) => new Date(entry.completionTimestamp) >= start)
  );
}

export function calculateMonthlyProgress(
  entries: PaymentJourneyEntry[],
  now = new Date()
): MonthlyProgress {
  const monthEntries = filterJourneyEntries(entries, "month", now);
  const estimatedRewards = monthEntries.reduce(
    (sum, entry) => sum + (entry.estimatedRewardValue || 0),
    0
  );
  const confidenceValues = monthEntries
    .map((entry) => entry.confidence)
    .filter((value) => Number.isFinite(value));

  return {
    smartPayments: monthEntries.length,
    estimatedRewards,
    averageConfidence: confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) /
        confidenceValues.length
      : null,
    bestMerchant: mostFrequent(monthEntries.map((entry) => entry.merchant)),
    mostUsedCard: mostFrequent(monthEntries.map((entry) => entry.selectedCard))
  };
}

export function updateJourneyNotes(
  entries: PaymentJourneyEntry[],
  paymentId: string,
  userNotes: string
) {
  return entries.map((entry) =>
    entry.paymentId === paymentId ? { ...entry, userNotes: userNotes.trim() } : entry
  );
}

export function reinforcementMessage(entry: PaymentJourneyEntry) {
  const summary = entry.recommendationExplanation.summary.toLowerCase();
  if (summary.includes("protection")) {
    return "Nice work. This purchase may include valuable protection.";
  }
  if (entry.confidence >= 0.9) {
    return "Excellent. You chose with high confidence.";
  }
  if (entry.estimatedRewardValue && entry.estimatedRewardValue > 0) {
    return "Great choice. You captured more value from this purchase.";
  }
  return "Smart decision saved. Rewardly will keep building your payment journey.";
}

export function safeJourneyEntries(value: unknown): PaymentJourneyEntry[] {
  if (!Array.isArray(value)) return [];
  return sortJourneyEntries(
    value.filter((item): item is PaymentJourneyEntry => {
      if (!item || typeof item !== "object") return false;
      const entry = item as PaymentJourneyEntry;
      return Boolean(
        entry.paymentId &&
          entry.decisionId &&
          entry.merchant &&
          Number.isFinite(entry.purchaseAmount) &&
          entry.completionTimestamp
      );
    })
  );
}

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
