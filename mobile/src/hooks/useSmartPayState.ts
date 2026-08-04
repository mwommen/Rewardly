import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { MerchantSuggestion } from "@/types/rewardly";

const recentMerchantKey = ["recentMerchants"];
const lastAmountKey = ["lastPurchaseAmount"];

export function useRecentMerchants() {
  return useQuery({
    queryKey: recentMerchantKey,
    queryFn: () => getJson<MerchantSuggestion[]>(storageKeys.recentMerchants, [])
  });
}

export function useLastPurchaseAmount() {
  return useQuery({
    queryKey: lastAmountKey,
    queryFn: () => getJson<string>(storageKeys.lastPurchaseAmount, "127")
  });
}

export function useSmartPayStateActions() {
  const queryClient = useQueryClient();

  const saveRecentMerchants = useMutation({
    mutationFn: async (merchants: MerchantSuggestion[]) => {
      const trimmed = merchants.slice(0, 8);
      await setJson(storageKeys.recentMerchants, trimmed);
      return trimmed;
    },
    onSuccess: (merchants) => {
      queryClient.setQueryData(recentMerchantKey, merchants);
    }
  });

  const saveLastAmount = useMutation({
    mutationFn: async (amount: string) => {
      await setJson(storageKeys.lastPurchaseAmount, amount);
      return amount;
    },
    onSuccess: (amount) => {
      queryClient.setQueryData(lastAmountKey, amount);
    }
  });

  return {
    rememberMerchant(merchant: MerchantSuggestion) {
      const existing =
        queryClient.getQueryData<MerchantSuggestion[]>(recentMerchantKey) || [];
      const normalizedName = merchant.name.trim().toLowerCase();
      const withoutDuplicate = existing.filter(
        (item) => item.name.trim().toLowerCase() !== normalizedName
      );
      saveRecentMerchants.mutate([merchant, ...withoutDuplicate]);
    },
    rememberAmount(amount: string) {
      if (amount.trim()) {
        saveLastAmount.mutate(amount.trim());
      }
    },
    clearRecentMerchants() {
      saveRecentMerchants.mutate([]);
    }
  };
}
