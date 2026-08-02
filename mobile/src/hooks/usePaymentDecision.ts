import { useMutation } from "@tanstack/react-query";
import { createPaymentDecisionIntent } from "@/api/rewardly";

export function usePaymentDecision() {
  return useMutation({
    mutationFn: createPaymentDecisionIntent
  });
}
