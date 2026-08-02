import { rewardlyApi } from "@/api/client";
import type {
  CatalogCard,
  MerchantInsight,
  MerchantKnowledgeProfile,
  MerchantSearchResult,
  PaymentDecisionRequest,
  PaymentDecisionResponse
} from "@/types/rewardly";
import type {
  AddPlanItemInput,
  CreatePlanInput,
  PlanOptimization,
  ShoppingPlan,
  ShoppingPlanItem
} from "@/types/planning";
import type { FinancialIntentResponse, FinancialIntentType } from "@/types/financialIntent";

export async function fetchCardCatalog() {
  const response = await rewardlyApi.get<{ cards: CatalogCard[] }>("/api/v1/card-catalog");
  return response.data.cards;
}

export async function fetchMerchants(params?: { category?: string; limit?: number }) {
  const response = await rewardlyApi.get<{
    merchants: MerchantKnowledgeProfile[];
    summary: Record<string, unknown>;
  }>("/api/v1/merchants", { params });
  return response.data;
}

export async function searchMerchants(params?: {
  q?: string;
  category?: string;
  limit?: number;
}) {
  const response = await rewardlyApi.get<{ merchants: MerchantSearchResult[] }>(
    "/api/v1/merchant-search",
    { params }
  );
  return response.data.merchants;
}

export async function fetchMerchantProfile(merchantId: string) {
  const response = await rewardlyApi.get<{ merchant: MerchantKnowledgeProfile }>(
    `/api/v1/merchants/${merchantId}`
  );
  return response.data.merchant;
}

export async function fetchMerchantInsight(merchantId: string) {
  const response = await rewardlyApi.get<{ insight: MerchantInsight }>(
    "/api/v1/merchant-insights",
    { params: { merchantId } }
  );
  return response.data.insight;
}

export async function createPaymentDecision(request: PaymentDecisionRequest) {
  const response = await rewardlyApi.post<PaymentDecisionResponse>(
    "/api/v1/payment-decisions",
    request,
  );
  return response.data;
}

export async function createFinancialIntent<T = unknown>({
  type,
  payload,
  requestId
}: {
  type: FinancialIntentType;
  payload?: unknown;
  requestId?: string;
}) {
  const response = await rewardlyApi.post<FinancialIntentResponse<T>>("/api/v1/intents", {
    type,
    payload,
    requestId
  });
  return response.data;
}

export async function createPaymentDecisionIntent(request: PaymentDecisionRequest) {
  const response = await createFinancialIntent<PaymentDecisionResponse>({
    type: "SMART_PAY",
    payload: request
  });
  return response.result;
}

export async function checkApiHealth() {
  const response = await rewardlyApi.get<{ status: string }>("/health");
  return response.data;
}

export async function fetchPlans() {
  const response = await rewardlyApi.get<{ plans: ShoppingPlan[] }>("/api/v1/plans");
  return response.data.plans;
}

export async function fetchPlan(planId: string) {
  const response = await rewardlyApi.get<{ plan: ShoppingPlan }>(
    `/api/v1/plans/${planId}`
  );
  return response.data.plan;
}

export async function createPlan(input: CreatePlanInput) {
  const response = await rewardlyApi.post<{ plan: ShoppingPlan }>("/api/v1/plans", input);
  return response.data.plan;
}

export async function addPlanItem(planId: string, input: AddPlanItemInput) {
  const response = await rewardlyApi.post<{ item: ShoppingPlanItem }>(
    `/api/v1/plans/${planId}/items`,
    input
  );
  return response.data.item;
}

export async function markPlanItemComplete(
  planId: string,
  itemId: string,
  decisionId?: string
) {
  const response = await rewardlyApi.patch<{ item: ShoppingPlanItem }>(
    `/api/v1/plans/${planId}/items/${itemId}`,
    { decisionId }
  );
  return response.data.item;
}

export async function optimizePlan(
  planId: string,
  wallet: { cards: Array<{ cardId: string }> }
) {
  const response = await rewardlyApi.post<PlanOptimization>(
    `/api/v1/plans/${planId}/optimize`,
    { wallet }
  );
  return response.data;
}
