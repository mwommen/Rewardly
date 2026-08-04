import { useQuery } from "@tanstack/react-query";
import { checkApiHealth } from "@/api/rewardly";

export function useApiHealth() {
  return useQuery({
    queryKey: ["apiHealth"],
    queryFn: checkApiHealth,
    retry: 1,
    staleTime: 1000 * 30
  });
}
