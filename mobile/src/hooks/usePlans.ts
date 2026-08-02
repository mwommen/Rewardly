import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addPlanItem,
  createPlan,
  fetchPlan,
  fetchPlans,
  markPlanItemComplete,
  optimizePlan
} from "@/api/rewardly";
import type { AddPlanItemInput, CreatePlanInput } from "@/types/planning";
import { useWallet } from "./useWallet";

const plansKey = ["plans"];

export function usePlans() {
  return useQuery({
    queryKey: plansKey,
    queryFn: fetchPlans
  });
}

export function usePlan(planId: string) {
  return useQuery({
    queryKey: ["plan", planId],
    queryFn: () => fetchPlan(planId),
    enabled: Boolean(planId)
  });
}

export function usePlanOptimization(planId: string) {
  const wallet = useWallet();
  return useQuery({
    queryKey: ["planOptimization", planId, wallet.data?.map((card) => card.cardId).join(",")],
    queryFn: () =>
      optimizePlan(planId, {
        cards: (wallet.data || []).map((card) => ({ cardId: card.cardId }))
      }),
    enabled: Boolean(planId && wallet.data?.length)
  });
}

export function usePlanActions() {
  const queryClient = useQueryClient();

  const createPlanMutation = useMutation({
    mutationFn: (input: CreatePlanInput) => createPlan(input),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: plansKey });
      queryClient.setQueryData(["plan", plan.planId], plan);
    }
  });

  const addItemMutation = useMutation({
    mutationFn: ({ planId, input }: { planId: string; input: AddPlanItemInput }) =>
      addPlanItem(planId, input),
    onSuccess: (_item, variables) => {
      queryClient.invalidateQueries({ queryKey: plansKey });
      queryClient.invalidateQueries({ queryKey: ["plan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["planOptimization", variables.planId] });
    }
  });

  const completeItemMutation = useMutation({
    mutationFn: ({
      planId,
      itemId,
      decisionId
    }: {
      planId: string;
      itemId: string;
      decisionId?: string;
    }) => markPlanItemComplete(planId, itemId, decisionId),
    onSuccess: (_item, variables) => {
      queryClient.invalidateQueries({ queryKey: plansKey });
      queryClient.invalidateQueries({ queryKey: ["plan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["planOptimization", variables.planId] });
    }
  });

  return {
    createPlan: createPlanMutation.mutateAsync,
    addItem: addItemMutation.mutateAsync,
    completeItem: completeItemMutation.mutateAsync,
    isSaving:
      createPlanMutation.isPending ||
      addItemMutation.isPending ||
      completeItemMutation.isPending
  };
}
