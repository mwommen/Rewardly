import crypto from "crypto";
import { decidePayment } from "./paymentDecisionService";

export type PlanningErrorCode =
  "INVALID_REQUEST" | "PLAN_NOT_FOUND" | "ENGINE_FAILURE";

export type PlanningError = {
  status: number;
  code: PlanningErrorCode;
  message: string;
};

export type PlannedMerchant = {
  name: string;
  category?: string;
  domain?: string;
};

export type PlannedPurchase = {
  amount: number;
  currency: "USD";
};

export type PlannedPurchaseItem = {
  itemId: string;
  merchant: PlannedMerchant;
  purchase: PlannedPurchase;
  notes?: string;
  completionState: "planned" | "completed";
  completedAt?: string;
  completedDecisionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingPlan = {
  planId: string;
  title: string;
  notes?: string;
  status: "active" | "completed";
  currency: "USD";
  items: PlannedPurchaseItem[];
  createdAt: string;
  updatedAt: string;
};

export type PlanOptimizationRequest = {
  wallet: {
    cards: Array<{ cardId: string }>;
  };
};

export type PlanOptimizedItem = {
  itemId: string;
  merchant: PlannedMerchant;
  purchase: PlannedPurchase;
  completionState: PlannedPurchaseItem["completionState"];
  decision: PublicPaymentDecisionResponse;
};

export type PublicPaymentDecisionResponse = {
  decisionId: string;
  status: "recommended" | "no_recommendation";
  recommendedPaymentMethod: { cardId: string; displayName: string } | null;
  reason: string;
  estimatedValue: number | null;
  currency: "USD";
  confidence: number;
  explanation: {
    summary: string;
    factors: string[];
  };
  trust?: {
    trustRecordId: string;
    status: "complete" | "partial" | "unavailable";
    evidenceUrl: string;
    trustUrl: string;
    replayable: boolean;
  };
};

export type PlanOptimizationResponse = {
  planId: string;
  title: string;
  estimatedTotalRewards: number | null;
  currency: "USD";
  optimizedItems: PlanOptimizedItem[];
  opportunitySummary: string;
  progress: {
    plannedPurchases: number;
    completedPurchases: number;
    remainingPurchases: number;
    estimatedRewardsEarned: number;
    estimatedRewardsRemaining: number;
  };
};

const plans = new Map<string, ShoppingPlan>();

export function resetPlanningStoreForTests() {
  plans.clear();
}

export function createShoppingPlan(body: any): ShoppingPlan | PlanningError {
  const title = cleanString(body?.title);
  if (!title) return invalid("title is required");
  if (title.length > 120)
    return invalid("title must be 120 characters or fewer");
  const notes = cleanString(body?.notes);
  if (notes.length > 500)
    return invalid("notes must be 500 characters or fewer");
  const timestamp = new Date().toISOString();
  const plan: ShoppingPlan = {
    planId: createPlanId(),
    title,
    notes: notes || undefined,
    status: "active",
    currency: "USD",
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  plans.set(plan.planId, plan);
  return clonePlan(plan);
}

export function listShoppingPlans() {
  return [...plans.values()]
    .map(clonePlan)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export function getShoppingPlan(planId: string): ShoppingPlan | null {
  const plan = plans.get(planId);
  return plan ? clonePlan(plan) : null;
}

export function updateShoppingPlan(
  planId: string,
  body: any,
): ShoppingPlan | PlanningError {
  const plan = plans.get(planId);
  if (!plan) return notFound();
  const title =
    body?.title === undefined ? plan.title : cleanString(body.title);
  if (!title) return invalid("title is required");
  const notes =
    body?.notes === undefined ? plan.notes : cleanString(body.notes);
  if (title.length > 120)
    return invalid("title must be 120 characters or fewer");
  if ((notes || "").length > 500) {
    return invalid("notes must be 500 characters or fewer");
  }
  const status =
    body?.status === undefined ? plan.status : cleanString(body.status);
  if (status !== "active" && status !== "completed") {
    return invalid("status must be active or completed");
  }
  plan.title = title;
  plan.notes = notes || undefined;
  plan.status = status;
  plan.updatedAt = new Date().toISOString();
  return clonePlan(plan);
}

export function deleteShoppingPlan(planId: string): boolean {
  return plans.delete(planId);
}

export function addPlanItem(
  planId: string,
  body: any,
): PlannedPurchaseItem | PlanningError {
  const plan = plans.get(planId);
  if (!plan) return notFound();
  const itemValidation = validatePlanItem(body);
  if ("status" in itemValidation) return itemValidation;
  const duplicate = plan.items.some(
    (item) =>
      normalize(item.merchant.name) ===
        normalize(itemValidation.merchant.name) &&
      item.purchase.amount === itemValidation.purchase.amount &&
      item.completionState === "planned",
  );
  if (duplicate) {
    return invalid("plan already contains this planned merchant and amount");
  }
  const timestamp = new Date().toISOString();
  const item: PlannedPurchaseItem = {
    itemId: createItemId(),
    ...itemValidation,
    completionState: "planned",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  plan.items.push(item);
  plan.updatedAt = timestamp;
  return { ...item };
}

export function markPlanItemComplete(
  planId: string,
  itemId: string,
  body: any = {},
): PlannedPurchaseItem | PlanningError {
  const plan = plans.get(planId);
  if (!plan) return notFound();
  const item = plan.items.find((candidate) => candidate.itemId === itemId);
  if (!item) {
    return {
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "plan item not found",
    };
  }
  item.completionState = "completed";
  item.completedAt = new Date().toISOString();
  item.completedDecisionId =
    cleanString(body?.decisionId) || item.completedDecisionId;
  item.updatedAt = item.completedAt;
  plan.updatedAt = item.updatedAt;
  if (
    plan.items.length &&
    plan.items.every((candidate) => candidate.completionState === "completed")
  ) {
    plan.status = "completed";
  }
  return { ...item };
}

export async function optimizeShoppingPlan(
  planId: string,
  body: any,
): Promise<PlanOptimizationResponse | PlanningError> {
  const plan = plans.get(planId);
  if (!plan) return notFound();
  const validation = validateOptimizeRequest(body);
  if ("status" in validation) return validation;
  if (!plan.items.length)
    return invalid("plan must include at least one item before optimization");

  try {
    const optimizedItems: PlanOptimizedItem[] = [];
    for (const item of plan.items) {
      const fallbackDecisionId = createPlanningDecisionId();
      const decision = await decidePayment({
        userId: fallbackDecisionId,
        merchant: item.merchant.name,
        hostname: item.merchant.domain,
        category: item.merchant.category,
        amount: item.purchase.amount,
        manualCardSlugs: validation.wallet.cards.map((card) => card.cardId),
        restrictToWallet: true,
        purchaseContext: {
          surface: "backend",
          amount: item.purchase.amount,
          currency: item.purchase.currency,
          checkoutDetected: false,
          checkoutStage: "payment",
        },
      });
      optimizedItems.push({
        itemId: item.itemId,
        merchant: item.merchant,
        purchase: item.purchase,
        completionState: item.completionState,
        decision: toPlanningPaymentDecisionResponse(
          decision,
          fallbackDecisionId,
        ),
      });
    }

    const estimatedTotalRewards = sumKnownRewards(optimizedItems);
    const estimatedRewardsEarned = sumKnownRewards(
      optimizedItems.filter((item) => item.completionState === "completed"),
    );
    const estimatedRewardsRemaining = sumKnownRewards(
      optimizedItems.filter((item) => item.completionState !== "completed"),
    );
    const completedPurchases = optimizedItems.filter(
      (item) => item.completionState === "completed",
    ).length;

    return {
      planId: plan.planId,
      title: plan.title,
      estimatedTotalRewards,
      currency: "USD",
      optimizedItems,
      opportunitySummary: opportunitySummary(optimizedItems),
      progress: {
        plannedPurchases: optimizedItems.length,
        completedPurchases,
        remainingPurchases: optimizedItems.length - completedPurchases,
        estimatedRewardsEarned: estimatedRewardsEarned || 0,
        estimatedRewardsRemaining: estimatedRewardsRemaining || 0,
      },
    };
  } catch (error) {
    console.error(
      "[planningService] optimization failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      status: 500,
      code: "ENGINE_FAILURE",
      message: "Rewardly could not optimize this plan.",
    };
  }
}

export function toPlanningPaymentDecisionResponse(
  decision: any,
  fallbackDecisionId: string,
): PublicPaymentDecisionResponse {
  const recommendation = decision.recommendedCard;
  const narrative = decision.decisionNarrative;
  const estimatedValue =
    narrative?.estimatedRewardValue ??
    recommendation?.rewardEstimate?.estimatedValueUSD ??
    decision.winningReason?.estimatedValue ??
    null;
  const confidence =
    decision.confidence?.score ??
    recommendation?.confidence?.score ??
    confidenceScoreFromLabel(decision.confidence?.label);
  const reason =
    firstNonEmptyString([
      narrative?.primaryReason?.summary,
      decision.primaryReason?.detail,
      decision.recommendationSummary,
      recommendation
        ? "Rewardly recommends this payment method for this planned purchase."
        : "Add cards to your wallet to optimize this planned purchase.",
    ]) || "Rewardly evaluated the cards in this wallet.";
  const summary =
    firstNonEmptyString([
      narrative?.summary,
      decision.recommendationSummary,
      "Rewardly evaluated the cards in this wallet.",
    ]) || "Rewardly evaluated the cards in this wallet.";

  return {
    decisionId:
      typeof decision.decisionId === "string" && decision.decisionId
        ? decision.decisionId
        : fallbackDecisionId,
    status: recommendation ? "recommended" : "no_recommendation",
    recommendedPaymentMethod: recommendation
      ? {
          cardId: recommendation.card.slug,
          displayName: recommendation.card.name,
        }
      : null,
    reason,
    estimatedValue: Number.isFinite(Number(estimatedValue))
      ? Number(estimatedValue)
      : null,
    currency: "USD",
    confidence: clampConfidence(confidence),
    explanation: {
      summary,
      factors: [
        narrative?.estimatedReward,
        narrative?.comparison,
        decision.primaryReason?.detail,
      ]
        .filter(
          (value): value is string =>
            typeof value === "string" && Boolean(value.trim()),
        )
        .slice(0, 4),
    },
  };
}

function validatePlanItem(body: any):
  | {
      merchant: PlannedMerchant;
      purchase: PlannedPurchase;
      notes?: string;
    }
  | PlanningError {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("request body must be an object");
  }
  if (
    !body.merchant ||
    typeof body.merchant !== "object" ||
    Array.isArray(body.merchant)
  ) {
    return invalid("merchant is required");
  }
  const merchantName = cleanString(body.merchant.name);
  if (!merchantName) return invalid("merchant.name is required");
  if (merchantName.length > 160)
    return invalid("merchant.name must be 160 characters or fewer");

  if (
    !body.purchase ||
    typeof body.purchase !== "object" ||
    Array.isArray(body.purchase)
  ) {
    return invalid("purchase is required");
  }
  const amount = Number(body.purchase.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return invalid("purchase.amount must be greater than zero");
  }
  const currency = cleanString(body.purchase.currency).toUpperCase();
  if (currency !== "USD") return invalid("purchase.currency must be USD");
  const notes = cleanString(body.notes);
  if (notes.length > 500)
    return invalid("notes must be 500 characters or fewer");

  return {
    merchant: {
      name: merchantName,
      category: cleanString(body.merchant.category) || undefined,
      domain: cleanString(body.merchant.domain) || undefined,
    },
    purchase: { amount, currency: "USD" },
    notes: notes || undefined,
  };
}

function validateOptimizeRequest(
  body: any,
): PlanOptimizationRequest | PlanningError {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("request body must be an object");
  }
  if (
    !body.wallet ||
    typeof body.wallet !== "object" ||
    Array.isArray(body.wallet)
  ) {
    return invalid("wallet is required");
  }
  if (!Array.isArray(body.wallet.cards)) {
    return invalid("wallet.cards must be an array");
  }
  if (body.wallet.cards.length > 30) {
    return invalid("wallet.cards supports at most 30 cards");
  }
  const cards: Array<{ cardId: string; error: string }> = body.wallet.cards.map(
    (card: any, index: number) => {
      if (!card || typeof card !== "object" || Array.isArray(card)) {
        return {
          cardId: "",
          error: `wallet.cards[${index}] must be an object`,
        };
      }
      return {
        cardId: normalizeCardId(card.cardId),
        error: "",
      };
    },
  );
  const objectError = cards.find((card) => card.error);
  if (objectError) return invalid(objectError.error);
  const invalidIndex = cards.findIndex((card) => !card.cardId);
  if (invalidIndex >= 0)
    return invalid(`wallet.cards[${invalidIndex}].cardId is required`);
  const unique = new Set(cards.map((card) => card.cardId));
  if (unique.size !== cards.length)
    return invalid("wallet.cards contains duplicate cardId values");
  return { wallet: { cards: cards.map((card) => ({ cardId: card.cardId })) } };
}

function sumKnownRewards(items: PlanOptimizedItem[]) {
  const values = items
    .map((item) => item.decision.estimatedValue)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

function opportunitySummary(items: PlanOptimizedItem[]) {
  const recommended = items.filter(
    (item) => item.decision.recommendedPaymentMethod,
  );
  if (!recommended.length) {
    return "Add cards to your wallet to optimize this plan.";
  }
  const cardNames = new Set(
    recommended.map(
      (item) => item.decision.recommendedPaymentMethod?.displayName,
    ),
  );
  if (cardNames.size === 1) {
    return `Rewardly found one card that works best across this plan.`;
  }
  return `Rewardly found ${cardNames.size} best-card choices across this plan.`;
}

function clonePlan(plan: ShoppingPlan): ShoppingPlan {
  return {
    ...plan,
    items: plan.items.map((item) => ({ ...item })),
  };
}

function invalid(message: string): PlanningError {
  return { status: 400, code: "INVALID_REQUEST", message };
}

function notFound(): PlanningError {
  return { status: 404, code: "PLAN_NOT_FOUND", message: "plan not found" };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmptyString(values: unknown[]) {
  return values.find(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function confidenceScoreFromLabel(label: unknown) {
  if (label === "HIGH" || label === "high") return 0.9;
  if (label === "MEDIUM" || label === "medium") return 0.65;
  if (label === "LOW" || label === "low") return 0.35;
  return 0;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCardId(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createPlanId() {
  return `plan_${crypto.randomUUID()}`;
}

function createItemId() {
  return `pitem_${crypto.randomUUID()}`;
}

function createPlanningDecisionId() {
  return `pdec_${crypto.randomUUID()}`;
}
