import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { DismissedOpportunity } from "@/types/walletCoach";
import {
  addDismissedOpportunity,
  createWalletCoachSnapshot,
  safeDismissedOpportunities
} from "@/utils/walletCoach";
import { usePaymentJourney } from "./usePaymentJourney";
import { useWallet } from "./useWallet";

const dismissedKey = ["walletCoachDismissedOpportunities"];
const snapshotKey = ["walletCoachSnapshot"];

export function useWalletCoach() {
  const wallet = useWallet();
  const journey = usePaymentJourney();
  const dismissed = useQuery({
    queryKey: dismissedKey,
    queryFn: async () => {
      const stored = await getJson<unknown>(
        storageKeys.walletCoachDismissedOpportunities,
        []
      );
      return safeDismissedOpportunities(stored);
    }
  });

  const snapshot = useMemo(() => {
    const dismissedIds = (dismissed.data || []).map((item) => item.opportunityId);
    return createWalletCoachSnapshot({
      wallet: wallet.data || [],
      journey: journey.data || [],
      dismissedOpportunityIds: dismissedIds
    });
  }, [dismissed.data, journey.data, wallet.data]);

  useEffect(() => {
    setJson(storageKeys.walletCoachSnapshot, snapshot).catch(() => {
      // Coaching remains deterministic if snapshot persistence fails.
    });
  }, [snapshot]);

  return {
    data: snapshot,
    isLoading: wallet.isLoading || journey.isLoading || dismissed.isLoading,
    isRefetching: wallet.isRefetching || journey.isRefetching || dismissed.isRefetching,
    refetch() {
      wallet.refetch();
      journey.refetch();
      dismissed.refetch();
    }
  };
}

export function useWalletCoachActions() {
  const queryClient = useQueryClient();

  const saveDismissed = useMutation({
    mutationFn: async (items: DismissedOpportunity[]) => {
      const safeItems = safeDismissedOpportunities(items);
      await setJson(storageKeys.walletCoachDismissedOpportunities, safeItems);
      return safeItems;
    },
    onSuccess: (items) => {
      queryClient.setQueryData(dismissedKey, items);
      queryClient.invalidateQueries({ queryKey: snapshotKey });
    }
  });

  return {
    dismissOpportunity(opportunityId: string) {
      const existing =
        queryClient.getQueryData<DismissedOpportunity[]>(dismissedKey) || [];
      saveDismissed.mutate(addDismissedOpportunity(existing, opportunityId));
    },
    clearDismissedOpportunities() {
      saveDismissed.mutate([]);
    },
    isSaving: saveDismissed.isPending
  };
}
