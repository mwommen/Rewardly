import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function usePaymentJourney() {
  return useQuery({
    queryKey: journeyKey,
    queryFn: async () => {
      const stored = await getJson<unknown>(storageKeys.paymentJourney, []);
      return safeJourneyEntries(stored);
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
