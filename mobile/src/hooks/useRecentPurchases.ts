import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJson, setJson } from "@/storage/secureStorage";
import { storageKeys } from "@/storage/keys";
import type { RecentPurchase } from "@/types/rewardly";

export function useRecentPurchases() {
  return useQuery<RecentPurchase[]>({
    queryKey: ["recentPurchases"],
    queryFn: () => getJson<RecentPurchase[]>(storageKeys.recentPurchases, [])
  });
}

export function useRecentPurchaseActions() {
  const queryClient = useQueryClient();

  const saveRecent = useMutation({
    mutationFn: async (next: RecentPurchase[]) => {
      const trimmed = next.slice(0, 12);
      await setJson(storageKeys.recentPurchases, trimmed);
      return trimmed;
    },
    onSuccess: (recent) => {
      queryClient.setQueryData(["recentPurchases"], recent);
    }
  });

  return {
    addRecentPurchase(purchase: RecentPurchase) {
      const existing = queryClient.getQueryData<RecentPurchase[]>(["recentPurchases"]) || [];
      saveRecent.mutate([purchase, ...existing]);
    },
    clearRecentPurchases() {
      saveRecent.mutate([]);
    }
  };
}
