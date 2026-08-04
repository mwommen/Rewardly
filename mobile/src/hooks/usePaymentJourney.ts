import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCloudPaymentJourney,
  fetchCloudPaymentJourney
} from "@/api/rewardly";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { PaymentJourneyEntry } from "@/types/paymentJourney";
import type { PaymentDecisionResponse } from "@/types/rewardly";
import {
  addPaymentJourneyEntry,
  createPaymentJourneyEntry,
  safeJourneyEntries,
  updateJourneyNotes
} from "@/utils/paymentJourney";

const journeyKey = ["paymentJourney"];

type CloudPaymentJourneyEntry = {
  paymentId: string;
  decisionId?: string | null;
  merchant: string;
  amount: number;
  currency?: "USD";
  recommendedCard?: string | null;
  selectedCard?: string | null;
  estimatedValue?: number | null;
  confidence?: number | null;
  notes?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export function usePaymentJourney() {
  return useQuery<PaymentJourneyEntry[]>({
    queryKey: journeyKey,
    queryFn: async () => {
      try {
        const cloudEntries = await fetchCloudPaymentJourney();
        const mapped = safeJourneyEntries(
          (cloudEntries as CloudPaymentJourneyEntry[]).map((entry) => ({
            paymentId: entry.paymentId,
            decisionId: entry.decisionId || entry.paymentId,
            merchant: entry.merchant,
            purchaseAmount: entry.amount,
            currency: entry.currency || "USD",
            recommendedCard: entry.recommendedCard || "Rewardly recommendation",
            selectedCard: entry.selectedCard || entry.recommendedCard || "Rewardly recommendation",
            estimatedRewardValue: entry.estimatedValue ?? null,
            confidence: entry.confidence ?? 0,
            recommendationExplanation: {
              summary: "Saved from your cloud payment journey.",
              factors: []
            },
            purchaseTimestamp: entry.completedAt || entry.createdAt,
            completionTimestamp: entry.completedAt || entry.createdAt,
            userNotes: entry.notes || undefined,
            syncStatus: "local",
            schemaVersion: 1
          }))
        );
        await setJson(storageKeys.paymentJourney, mapped);
        return mapped;
      } catch {
        const stored = await getJson<unknown>(storageKeys.paymentJourney, []);
        return safeJourneyEntries(stored);
      }
    }
  });
}

export function usePaymentJourneyActions() {
  const queryClient = useQueryClient();

  const saveJourney = useMutation({
    mutationFn: async (entries: PaymentJourneyEntry[]) => {
      const safeEntries = safeJourneyEntries(entries);
      await setJson(storageKeys.paymentJourney, safeEntries);
      return safeEntries;
    },
    onSuccess: (entries) => {
      queryClient.setQueryData(journeyKey, entries);
    }
  });

  return {
    completePurchase({
      decision,
      merchant,
      amount,
      selectedCard
    }: {
      decision: PaymentDecisionResponse;
      merchant: string;
      amount: number;
      selectedCard?: string;
    }) {
      const existing =
        queryClient.getQueryData<PaymentJourneyEntry[]>(journeyKey) || [];
      const entry = createPaymentJourneyEntry({
        decision,
        merchant,
        amount,
        selectedCard
      });
      createCloudPaymentJourney({
        paymentId: entry.paymentId,
        clientIdempotencyKey: entry.paymentId,
        decisionId: entry.decisionId,
        merchant,
        amount,
        recommendedCard: entry.recommendedCard,
        selectedCard: entry.selectedCard,
        estimatedValue: entry.estimatedRewardValue,
        confidence: entry.confidence,
        notes: entry.userNotes,
        completedAt: entry.completionTimestamp
      }).catch(() => {
        // Local persistence remains the fallback if the user is offline.
      });
      saveJourney.mutate(addPaymentJourneyEntry(existing, entry));
      return entry;
    },
    updateNotes(paymentId: string, notes: string) {
      const existing =
        queryClient.getQueryData<PaymentJourneyEntry[]>(journeyKey) || [];
      saveJourney.mutate(updateJourneyNotes(existing, paymentId, notes));
    },
    clearJourney() {
      saveJourney.mutate([]);
    },
    isSaving: saveJourney.isPending
  };
}
