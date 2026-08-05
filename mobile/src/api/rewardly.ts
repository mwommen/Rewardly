import { rewardlyApi } from "@/api/client";
import type { AuthSession } from "@/types/auth";
import type { FavoriteMerchant } from "@/types/location";
import type {
  CatalogCard,
  DecisionTrustRecord,
  MerchantInsight,
  MerchantKnowledgeProfile,
  MerchantSearchResult,
  PaymentDecisionRequest,
  PaymentDecisionResponse,
} from "@/types/rewardly";
import type {
  AddPlanItemInput,
  CreatePlanInput,
  PlanOptimization,
  ShoppingPlan,
  ShoppingPlanItem,
} from "@/types/planning";
import type { FinancialIntentResponse, FinancialIntentType } from "@/types/financialIntent";

type CloudPreferences = {
  favoriteMerchants: FavoriteMerchant[];
  theme: "system" | "light" | "dark";
  defaultCurrency: "USD";
  onboardingCompleted: boolean;
  locationEnabled: boolean;
  syncRevision?: number;
};

export async function fetchCardCatalog() {
  const response = await rewardlyApi.get<{ cards: CatalogCard[] }>("/api/v1/card-catalog");
  return response.data.cards;
}

export async function signUp(input: {
  email: string;
  password: string;
  displayName?: string;
}) {
  const response = await rewardlyApi.post<AuthSession>("/api/v1/auth/signup", input);
  return response.data;
}

export async function signIn(input: { email: string; password: string }) {
  const response = await rewardlyApi.post<AuthSession>("/api/v1/auth/signin", input);
  return response.data;
}

export async function logout(refreshToken?: string) {
  await rewardlyApi.post("/api/v1/auth/logout", { refreshToken });
}

export async function deleteAccount() {
  const response = await rewardlyApi.delete<{ deleted: boolean }>("/api/v1/me/account");
  return response.data;
}

export async function fetchCloudWallet() {
  const response = await rewardlyApi.get<{ wallet: { cardSlugs: string[] } }>(
    "/api/v1/me/wallet",
  );
  return response.data.wallet;
}

export async function updateCloudWallet(cardSlugs: string[]) {
  const response = await rewardlyApi.put<{ wallet: { cardSlugs: string[] } }>(
    "/api/v1/me/wallet",
    { cardSlugs },
  );
  return response.data.wallet;
}

export async function fetchCloudPaymentJourney() {
  const response = await rewardlyApi.get<{ payments: unknown[] }>(
    "/api/v1/me/payment-journey",
  );
  return response.data.payments;
}

export async function createCloudPaymentJourney(input: unknown) {
  const response = await rewardlyApi.post<{ payment: unknown }>(
    "/api/v1/me/payment-journey",
    input,
  );
  return response.data.payment;
}

export async function fetchCloudPreferences() {
  const response = await rewardlyApi.get<{ preferences: CloudPreferences }>(
    "/api/v1/me/preferences",
  );
  return response.data.preferences;
}

export async function updateCloudPreferences(input: Partial<CloudPreferences>) {
  const response = await rewardlyApi.put<{ preferences: CloudPreferences }>(
    "/api/v1/me/preferences",
    input,
  );
  return response.data.preferences;
}

export async function importLocalData(input: unknown) {
  const response = await rewardlyApi.post("/api/v1/me/migration/import", input);
  return response.data;
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
    { params },
  );
  return response.data.merchants;
}

export async function fetchMerchantProfile(merchantId: string) {
  const response = await rewardlyApi.get<{ merchant: MerchantKnowledgeProfile }>(
    `/api/v1/merchants/${merchantId}`,
  );
  return response.data.merchant;
}

export async function fetchMerchantInsight(merchantId: string) {
  const response = await rewardlyApi.get<{ insight: MerchantInsight }>(
    "/api/v1/merchant-insights",
    { params: { merchantId } },
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

export async function fetchDecisionTrust(decisionId: string) {
  const response = await rewardlyApi.get<{ trust: DecisionTrustRecord }>(
    `/api/v1/decisions/${decisionId}/trust`,
  );
  return response.data.trust;
}

export async function createFinancialIntent<T = unknown>({
  type,
  payload,
  requestId,
}: {
  type: FinancialIntentType;
  payload?: unknown;
  requestId?: string;
}) {
  const response = await rewardlyApi.post<FinancialIntentResponse<T>>("/api/v1/intents", {
    type,
    payload,
    requestId,
  });
  return response.data;
}

export async function createPaymentDecisionIntent(request: PaymentDecisionRequest) {
  const response = await createFinancialIntent<PaymentDecisionResponse>({
    type: "SMART_PAY",
    payload: request,
  });
  return response.result;
}

export async function checkApiHealth() {
  const response = await rewardlyApi.get<{ status: string }>("/health");
  return response.data;
}

export async function fetchPlans() {
  const response = await rewardlyApi.get<{ plans: ShoppingPlan[] }>("/api/v1/me/plans");
  return response.data.plans;
}

export async function fetchPlan(planId: string) {
  const response = await rewardlyApi.get<{ plan: ShoppingPlan }>(
    `/api/v1/me/plans/${planId}`,
  );
  return response.data.plan;
}

export async function createPlan(input: CreatePlanInput) {
  const response = await rewardlyApi.post<{ plan: ShoppingPlan }>(
    "/api/v1/me/plans",
    input,
  );
  return response.data.plan;
}

export async function addPlanItem(planId: string, input: AddPlanItemInput) {
  const response = await rewardlyApi.post<{ item: ShoppingPlanItem }>(
    `/api/v1/me/plans/${planId}/items`,
    input,
  );
  return response.data.item;
}

export async function markPlanItemComplete(
  planId: string,
  itemId: string,
  decisionId?: string,
) {
  const response = await rewardlyApi.post<{ item: ShoppingPlanItem }>(
    `/api/v1/me/plans/${planId}/complete-item`,
    { itemId, decisionId },
  );
  return response.data.item;
}

export async function optimizePlan(
  planId: string,
  wallet: { cards: Array<{ cardId: string }> },
) {
  void wallet;
  const response = await rewardlyApi.post<PlanOptimization>(
    `/api/v1/me/plans/${planId}/optimize`,
    {},
  );
  return response.data;
}
