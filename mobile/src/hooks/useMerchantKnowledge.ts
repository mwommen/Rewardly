import { useQuery } from "@tanstack/react-query";
import {
  fetchMerchantInsight,
  fetchMerchantProfile,
  fetchMerchants,
  searchMerchants
} from "@/api/rewardly";

export function useMerchantKnowledge(limit = 24) {
  return useQuery({
    queryKey: ["merchantKnowledge", limit],
    queryFn: () => fetchMerchants({ limit })
  });
}

export function useMerchantSearch(query: string, limit = 24) {
  return useQuery({
    queryKey: ["merchantSearch", query.trim().toLowerCase(), limit],
    queryFn: () =>
      searchMerchants({
        q: query.trim(),
        limit
      }),
    enabled: query.trim().length > 0
  });
}

export function useMerchantProfile(merchantId: string | undefined) {
  return useQuery({
    queryKey: ["merchantProfile", merchantId],
    queryFn: () => fetchMerchantProfile(merchantId!),
    enabled: Boolean(merchantId)
  });
}

export function useMerchantInsight(merchantId: string | undefined) {
  return useQuery({
    queryKey: ["merchantInsight", merchantId],
    queryFn: () => fetchMerchantInsight(merchantId!),
    enabled: Boolean(merchantId)
  });
}
