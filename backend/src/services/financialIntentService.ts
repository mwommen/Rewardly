import crypto from "crypto";
import {
  decidePayment,
  type PaymentDecisionRequest,
} from "./paymentDecisionService";
import {
  markPlanItemComplete,
  optimizeShoppingPlan,
  type PlanningError,
  type PublicPaymentDecisionResponse,
} from "./planningService";
import {
  createOrResolveTrustRecord,
  trustReferenceFor,
} from "./trustInfrastructureService";

export type FinancialIntentType =
  | "SMART_PAY"
  | "PLAN_PURCHASES"
  | "COMPLETE_PURCHASE"
  | "REVIEW_PAYMENT_HISTORY"
  | "VIEW_WALLET_COACH"
  | "VIEW_OPPORTUNITIES"
  | "VIEW_WEEKLY_SUMMARY";

export type FinancialIntentResponse = {
  intentId: string;
  requestId: string;
  timestamp: string;
  intentType: FinancialIntentType;
  executedCapabilities: string[];
  result: unknown;
  warnings: string[];
  errors: Array<{ code: string; message: string }>;
  metadata: {
    executionTimeMs: number;
    success: boolean;
  };
};

export type FinancialIntentError = {
  status: number;
  code: "INVALID_INTENT" | "UNKNOWN_INTENT" | "ENGINE_FAILURE";
  message: string;
};

export type FinancialIntentEvent = {
  intentId: string;
  requestId: string;
  intentType: FinancialIntentType;
  timestamp: string;
  executionTimeMs: number;
  executedCapabilities: string[];
  success: boolean;
};

const intentResponses = new Map<string, FinancialIntentResponse>();
const intentEvents: FinancialIntentEvent[] = [];

export function resetFinancialIntentStoreForTests() {
  intentResponses.clear();
  intentEvents.length = 0;
}

export function getFinancialIntent(intentId: string) {
  return intentResponses.get(intentId) || null;
}

export function listFinancialIntentEvents() {
  return [...intentEvents];
}

export async function executeFinancialIntent(
  body: any,
): Promise<FinancialIntentResponse | FinancialIntentError> {
  const validation = validateFinancialIntent(body);
  if ("status" in validation) return validation;

  const startedAt = Date.now();
  const intentId = createIntentId();
  const timestamp = new Date().toISOString();
  const warnings: string[] = [];
  const errors: FinancialIntentResponse["errors"] = [];

  try {
    const routed = await routeIntent(
      validation.type,
      validation.payload,
      intentId,
    );
    if ("status" in routed) {
      errors.push({ code: routed.code, message: routed.message });
      const errorResponse = buildResponse({
        intentId,
        requestId: validation.requestId,
        timestamp,
        intentType: validation.type,
        executedCapabilities: routed.executedCapabilities,
        result: null,
        warnings,
        errors,
        startedAt,
        success: false,
      });
      persistIntent(errorResponse);
      return {
        status: routed.status,
        code: financialIntentErrorCode(routed.code),
        message: routed.message,
      };
    }

    const response = buildResponse({
      intentId,
      requestId: validation.requestId,
      timestamp,
      intentType: validation.type,
      executedCapabilities: routed.executedCapabilities,
      result: routed.result,
      warnings: routed.warnings || warnings,
      errors,
      startedAt,
      success: true,
    });
    persistIntent(response);
    return response;
  } catch (error) {
    const response = buildResponse({
      intentId,
      requestId: validation.requestId,
      timestamp,
      intentType: validation.type,
      executedCapabilities: [],
      result: null,
      warnings,
      errors: [
        {
          code: "ENGINE_FAILURE",
          message: "Rewardly could not execute this intent.",
        },
      ],
      startedAt,
      success: false,
    });
    persistIntent(response);
    console.error(
      "[financialIntentService] execution failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      status: 500,
      code: "ENGINE_FAILURE",
      message: "Rewardly could not execute this intent.",
    };
  }
}

function financialIntentErrorCode(code: string): FinancialIntentError["code"] {
  if (code === "ENGINE_FAILURE" || code === "UNKNOWN_INTENT") return code;
  return "INVALID_INTENT";
}

async function routeIntent(
  type: FinancialIntentType,
  payload: any,
  intentId: string,
): Promise<
  | { executedCapabilities: string[]; result: unknown; warnings?: string[] }
  | (PlanningError & { executedCapabilities: string[] })
  | (FinancialIntentError & { executedCapabilities: string[] })
> {
  if (type === "SMART_PAY") {
    const request = validateSmartPayPayload(payload);
    if ("status" in request) return { ...request, executedCapabilities: [] };
    const fallbackDecisionId = `pdec_${intentId.replace(/^fint_/, "")}`;
    const normalizedDecisionRequest: PaymentDecisionRequest = {
      userId: fallbackDecisionId,
      merchant: request.merchant.name,
      hostname: request.merchant.domain,
      category: request.merchant.category,
      mcc: request.merchant.mcc,
      amount: request.purchase.amount,
      manualCardSlugs: request.wallet.cards.map((card) => card.cardId),
      restrictToWallet: true,
      purchaseContext: {
        surface: "backend",
        amount: request.purchase.amount,
        currency: request.purchase.currency,
        checkoutDetected: true,
        checkoutStage: "payment",
      },
    };
    const decision = await decidePayment(normalizedDecisionRequest);
    const trustRecord = await createOrResolveTrustRecord({
      decisionId: fallbackDecisionId,
      decision,
      normalizedRequest: normalizedDecisionRequest,
      ownerUserId: null,
      tenantId: null,
    });
    return {
      executedCapabilities: ["PaymentDecisionService", "TrustInfrastructure"],
      result: {
        ...toPublicPaymentDecisionResponse(decision, fallbackDecisionId),
        trust: trustReferenceFor(trustRecord),
      },
    };
  }

  if (type === "PLAN_PURCHASES") {
    const planId = cleanString(payload?.planId);
    if (!planId) {
      return {
        status: 400,
        code: "INVALID_INTENT",
        message: "payload.planId is required",
        executedCapabilities: [],
      };
    }
    const result = await optimizeShoppingPlan(planId, payload);
    if ("status" in result) {
      return { ...result, executedCapabilities: ["PlanningEngine"] };
    }
    return {
      executedCapabilities: ["PlanningEngine", "PaymentDecisionService"],
      result,
    };
  }

  if (type === "COMPLETE_PURCHASE") {
    const planId = cleanString(payload?.planId);
    const itemId = cleanString(payload?.itemId);
    if (!planId || !itemId) {
      return {
        status: 400,
        code: "INVALID_INTENT",
        message: "payload.planId and payload.itemId are required",
        executedCapabilities: [],
      };
    }
    const result = markPlanItemComplete(planId, itemId, {
      decisionId: cleanString(payload?.decisionId) || undefined,
    });
    if ("status" in result) {
      return { ...result, executedCapabilities: ["PlanningEngine"] };
    }
    return {
      executedCapabilities: ["PlanningEngine", "PaymentJourney"],
      result: { item: result },
      warnings: [
        "Mobile clients should still persist completed purchases into local Payment Journey.",
      ],
    };
  }

  return {
    executedCapabilities: [capabilityForReadIntent(type)],
    result: {
      message: `${type} is acknowledged by the Financial Intent Platform.`,
      source: "client_or_existing_platform_state",
    },
    warnings: [
      "This intent is routed through the unified contract; backend-owned data expansion is future work.",
    ],
  };
}

function validateFinancialIntent(body: any):
  | {
      type: FinancialIntentType;
      payload: any;
      requestId: string;
    }
  | FinancialIntentError {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalidIntent("request body must be an object");
  }
  const type = cleanString(body.type).toUpperCase() as FinancialIntentType;
  const allowed: FinancialIntentType[] = [
    "SMART_PAY",
    "PLAN_PURCHASES",
    "COMPLETE_PURCHASE",
    "REVIEW_PAYMENT_HISTORY",
    "VIEW_WALLET_COACH",
    "VIEW_OPPORTUNITIES",
    "VIEW_WEEKLY_SUMMARY",
  ];
  if (!type) return invalidIntent("type is required");
  if (!allowed.includes(type)) {
    return {
      status: 400,
      code: "UNKNOWN_INTENT",
      message: "unsupported intent type",
    };
  }
  return {
    type,
    payload:
      body.payload && typeof body.payload === "object" ? body.payload : {},
    requestId: cleanString(body.requestId) || createRequestId(),
  };
}

function validateSmartPayPayload(payload: any):
  | {
      merchant: {
        name: string;
        category?: string;
        domain?: string;
        mcc?: string;
      };
      purchase: { amount: number; currency: "USD" };
      wallet: { cards: Array<{ cardId: string }> };
    }
  | FinancialIntentError {
  const merchantName = cleanString(payload?.merchant?.name);
  if (!merchantName) return invalidIntent("payload.merchant.name is required");
  const amount = Number(payload?.purchase?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return invalidIntent("payload.purchase.amount must be greater than zero");
  }
  const currency = cleanString(payload?.purchase?.currency).toUpperCase();
  if (currency !== "USD")
    return invalidIntent("payload.purchase.currency must be USD");
  if (!Array.isArray(payload?.wallet?.cards)) {
    return invalidIntent("payload.wallet.cards must be an array");
  }
  const cards = payload.wallet.cards.map((card: any) => ({
    cardId: normalizeCardId(card?.cardId),
  }));
  const invalidIndex = cards.findIndex(
    (card: { cardId: string }) => !card.cardId,
  );
  if (invalidIndex >= 0) {
    return invalidIntent(
      `payload.wallet.cards[${invalidIndex}].cardId is required`,
    );
  }
  if (
    new Set(cards.map((card: { cardId: string }) => card.cardId)).size !==
    cards.length
  ) {
    return invalidIntent(
      "payload.wallet.cards contains duplicate cardId values",
    );
  }
  return {
    merchant: {
      name: merchantName,
      category: cleanString(payload.merchant.category) || undefined,
      domain: cleanString(payload.merchant.domain) || undefined,
      mcc: cleanString(payload.merchant.mcc) || undefined,
    },
    purchase: { amount, currency: "USD" },
    wallet: { cards },
  };
}

function buildResponse({
  intentId,
  requestId,
  timestamp,
  intentType,
  executedCapabilities,
  result,
  warnings,
  errors,
  startedAt,
  success,
}: {
  intentId: string;
  requestId: string;
  timestamp: string;
  intentType: FinancialIntentType;
  executedCapabilities: string[];
  result: unknown;
  warnings: string[];
  errors: FinancialIntentResponse["errors"];
  startedAt: number;
  success: boolean;
}): FinancialIntentResponse {
  return {
    intentId,
    requestId,
    timestamp,
    intentType,
    executedCapabilities,
    result,
    warnings,
    errors,
    metadata: {
      executionTimeMs: Math.max(0, Date.now() - startedAt),
      success,
    },
  };
}

function persistIntent(response: FinancialIntentResponse) {
  intentResponses.set(response.intentId, response);
  intentEvents.push({
    intentId: response.intentId,
    requestId: response.requestId,
    intentType: response.intentType,
    timestamp: response.timestamp,
    executionTimeMs: response.metadata.executionTimeMs,
    executedCapabilities: response.executedCapabilities,
    success: response.metadata.success,
  });
}

function toPublicPaymentDecisionResponse(
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
        ? "Rewardly recommends this payment method for this purchase."
        : "Add cards to your wallet to get personalized recommendations.",
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
        ...(Array.isArray(narrative?.supportingReasons)
          ? narrative.supportingReasons.map((item: any) => item?.summary)
          : []),
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

function invalidIntent(message: string): FinancialIntentError {
  return { status: 400, code: "INVALID_INTENT", message };
}

function capabilityForReadIntent(type: FinancialIntentType) {
  const capabilities: Record<FinancialIntentType, string> = {
    SMART_PAY: "PaymentDecisionService",
    PLAN_PURCHASES: "PlanningEngine",
    COMPLETE_PURCHASE: "PaymentJourney",
    REVIEW_PAYMENT_HISTORY: "PaymentJourney",
    VIEW_WALLET_COACH: "WalletCoach",
    VIEW_OPPORTUNITIES: "OpportunityEngine",
    VIEW_WEEKLY_SUMMARY: "WalletCoach",
  };
  return capabilities[type];
}

function firstNonEmptyString(values: unknown[]) {
  return values.find(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCardId(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

function createIntentId() {
  return `fint_${crypto.randomUUID()}`;
}

function createRequestId() {
  return `freq_${crypto.randomUUID()}`;
}
