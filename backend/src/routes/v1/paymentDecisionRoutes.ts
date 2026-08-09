import { Router } from "express";
import crypto from "crypto";
import {
  decidePayment,
  type PaymentDecisionRequest,
} from "../../services/paymentDecisionService";
import { CARD_OVERRIDES } from "../../scrapers/overrides/cards";
import type { PaymentDecision } from "../../../../packages/rewardly-core/src";
import {
  planningOpenApiPaths,
  planningOpenApiResponses,
  planningOpenApiSchemas,
} from "./planningRoutes";
import {
  financialIntentOpenApiPaths,
  financialIntentOpenApiResponses,
  financialIntentOpenApiSchemas,
} from "./financialIntentRoutes";
import {
  merchantKnowledgeOpenApiPaths,
  merchantKnowledgeOpenApiResponses,
  merchantKnowledgeOpenApiSchemas,
} from "./merchantKnowledgeRoutes";
import {
  createOrResolveTrustRecord,
  type DecisionTrustRecord,
  trustReferenceFor,
} from "../../services/trustInfrastructureService";
import {
  createCanonicalDecisionResponse,
  createDeterministicDecisionId,
  type CanonicalDecisionLatency,
} from "../../services/canonicalDecisionResponseService";
import { authenticateAccessToken } from "../../services/productionAuthService";
import {
  decisionTrustOpenApiPaths,
  decisionTrustOpenApiResponses,
  decisionTrustOpenApiSchemas,
} from "./decisionTrustRoutes";
import { contextOpenApiPaths, contextOpenApiSchemas } from "./contextRoutes";
import {
  partnerOpenApiPaths,
  partnerOpenApiResponses,
  partnerOpenApiSchemas,
} from "./partnerRoutes";

const router = Router();

export const V1_PAYMENT_DECISIONS_ROUTE = "/payment-decisions";

type V1ErrorCode =
  "INVALID_REQUEST" | "UNSUPPORTED_PURCHASE" | "ENGINE_FAILURE";

type ValidationResult =
  | { ok: true; value: NormalizedV1PaymentDecisionRequest }
  | { ok: false; status: number; code: V1ErrorCode; message: string };

export type NormalizedV1PaymentDecisionRequest = {
  merchant: {
    name: string;
    category?: string;
    domain?: string;
    mcc?: string;
  };
  purchase: {
    amount: number;
    currency: "USD";
  };
  wallet: {
    cards: Array<{ cardId: string }>;
  };
  context?: Record<string, unknown>;
};

router.post(V1_PAYMENT_DECISIONS_ROUTE, async (req, res) => {
  const validation = validatePaymentDecisionRequest(req.body);
  if (!validation.ok) {
    return res.status(validation.status).json({
      error: {
        code: validation.code,
        message: validation.message,
      },
    });
  }

  try {
    const request = validation.value;
    const normalizedDecisionRequest: PaymentDecisionRequest = {
      userId: "pending-decision-id",
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
      context: request.context,
    };
    const decisionId = createDeterministicDecisionId(normalizedDecisionRequest);
    normalizedDecisionRequest.userId = decisionId;
    const authUser = await optionalAuthUser(req.headers.authorization);
    const startedAt = Date.now();
    const decision = await decidePayment(normalizedDecisionRequest);
    const engineCompletedAt = Date.now();
    const trustRecord = await createOrResolveTrustRecord({
      decisionId,
      decision,
      normalizedRequest: normalizedDecisionRequest,
      ownerUserId: authUser?.userId || null,
      tenantId: null,
    });
    const completedAt = Date.now();
    const latency: CanonicalDecisionLatency = {
      engineMs: engineCompletedAt - startedAt,
      evidenceGenerationMs: completedAt - engineCompletedAt,
      totalMs: completedAt - startedAt,
    };

    return res.json(
      toV1PaymentDecisionResponse(decision, decisionId, trustRecord, {
        normalizedRequest: normalizedDecisionRequest,
        latency,
      }),
    );
  } catch (error) {
    console.error(
      "[v1/payment-decisions] Engine failure:",
      error instanceof Error ? error.message : "unknown",
    );
    return res.status(500).json({
      error: {
        code: "ENGINE_FAILURE",
        message: "Rewardly could not create a payment decision.",
      },
    });
  }
});

router.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument());
});

router.get("/card-catalog", (_req, res) => {
  const cards = Object.values(CARD_OVERRIDES)
    .map((card: any) => ({
      cardId: card.slug,
      displayName: card.name,
      issuer: card.issuer || null,
      annualFee: Number.isFinite(card.annualFee) ? card.annualFee : null,
      rewardProgram: rewardProgramForCatalogCard(card),
    }))
    .filter((card) => card.cardId && card.displayName)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  res.json({ cards });
});

export default router;

export function validatePaymentDecisionRequest(body: any): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return invalid("request body must be an object");
  }
  const topLevelError = unknownKeys(
    body,
    ["merchant", "purchase", "wallet", "context"],
    "request",
  );
  if (topLevelError) return invalid(topLevelError);
  if (
    body.context !== undefined &&
    (!body.context ||
      typeof body.context !== "object" ||
      Array.isArray(body.context))
  ) {
    return invalid("context must be an object when supplied");
  }

  if (!body.merchant || typeof body.merchant !== "object") {
    return invalid("merchant is required");
  }
  if (Array.isArray(body.merchant))
    return invalid("merchant must be an object");
  const merchantKeyError = unknownKeys(
    body.merchant,
    ["name", "category", "domain", "mcc"],
    "merchant",
  );
  if (merchantKeyError) return invalid(merchantKeyError);
  const merchantName = cleanString(body.merchant.name);
  if (!merchantName) return invalid("merchant.name is required");
  if (merchantName.length > 160) {
    return invalid("merchant.name must be 160 characters or fewer");
  }

  if (!body.purchase || typeof body.purchase !== "object") {
    return invalid("purchase is required");
  }
  if (Array.isArray(body.purchase))
    return invalid("purchase must be an object");
  const purchaseKeyError = unknownKeys(
    body.purchase,
    ["amount", "currency"],
    "purchase",
  );
  if (purchaseKeyError) return invalid(purchaseKeyError);
  const amount = body.purchase.amount;
  if (amount === undefined || amount === null || amount === "") {
    return invalid("purchase.amount is required");
  }
  if (!Number.isFinite(Number(amount))) {
    return invalid("purchase.amount must be a finite number");
  }
  if (Number(amount) <= 0) {
    return invalid("purchase.amount must be greater than zero");
  }
  if (body.purchase.currency === undefined || body.purchase.currency === null) {
    return invalid("purchase.currency is required");
  }
  const currency = cleanString(body.purchase.currency).toUpperCase();
  if (currency !== "USD") {
    return {
      ok: false,
      status: 422,
      code: "UNSUPPORTED_PURCHASE",
      message: "purchase.currency must be USD",
    };
  }

  if (!body.wallet || typeof body.wallet !== "object") {
    return invalid("wallet is required");
  }
  if (Array.isArray(body.wallet)) return invalid("wallet must be an object");
  const walletKeyError = unknownKeys(body.wallet, ["cards"], "wallet");
  if (walletKeyError) return invalid(walletKeyError);
  if (!Array.isArray(body.wallet.cards)) {
    return invalid("wallet.cards must be an array");
  }
  if (body.wallet.cards.length > 30) {
    return invalid("wallet.cards supports at most 30 cards");
  }
  const cards = body.wallet.cards.map((card: any, index: number) => {
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      return { cardId: "", invalidObjectAt: index };
    }
    const cardKeyError = unknownKeys(
      card,
      ["cardId"],
      `wallet.cards[${index}]`,
    );
    return {
      cardId: normalizeCardId(card.cardId),
      invalidObjectAt: -1,
      tooLong:
        typeof card.cardId === "string" && card.cardId.trim().length > 80,
      cardKeyError,
    };
  });
  const invalidObject = cards.find((card: any) => card.invalidObjectAt >= 0);
  if (invalidObject) {
    return invalid(
      `wallet.cards[${invalidObject.invalidObjectAt}] must be an object`,
    );
  }
  const cardWithUnknownKey = cards.find((card: any) => card.cardKeyError);
  if (cardWithUnknownKey) return invalid(cardWithUnknownKey.cardKeyError);
  const tooLongCardIndex = cards.findIndex((card: any) => card.tooLong);
  if (tooLongCardIndex >= 0) {
    return invalid(
      `wallet.cards[${tooLongCardIndex}].cardId must be 80 characters or fewer`,
    );
  }
  const normalizedCards = cards.map((card: any) => ({ cardId: card.cardId }));
  const invalidCardIndex = normalizedCards.findIndex(
    (card: { cardId: string }) => !card.cardId,
  );
  if (invalidCardIndex >= 0) {
    return invalid(`wallet.cards[${invalidCardIndex}].cardId is required`);
  }
  const uniqueCardIds = new Set(
    normalizedCards.map((card: { cardId: string }) => card.cardId),
  );
  if (uniqueCardIds.size !== normalizedCards.length) {
    return invalid("wallet.cards contains duplicate cardId values");
  }

  return {
    ok: true,
    value: {
      merchant: {
        name: merchantName,
        category: cleanString(body.merchant.category) || undefined,
        domain: cleanString(body.merchant.domain) || undefined,
        mcc: cleanString(body.merchant.mcc) || undefined,
      },
      purchase: {
        amount: Number(amount),
        currency: "USD",
      },
      wallet: {
        cards: normalizedCards,
      },
      context: body.context,
    },
  };
}

export function toV1PaymentDecisionResponse(
  decision: PaymentDecision,
  fallbackDecisionId = createPublicDecisionId(),
  trustRecord?: DecisionTrustRecord,
  canonicalOptions?: {
    normalizedRequest: PaymentDecisionRequest;
    latency: CanonicalDecisionLatency;
  },
) {
  const recommendation = decision.recommendedCard;
  const narrative = decision.decisionNarrative;
  const estimatedValue =
    narrative?.estimatedRewardValue ??
    recommendation?.rewardEstimate?.estimatedValueUSD ??
    decision.winningReason?.estimatedValue ??
    null;
  const confidence =
    decision.confidence.score ??
    recommendation?.confidence?.score ??
    confidenceScoreFromLabel(decision.confidence.label);
  const decisionId =
    publicDecisionIdFromDecision(decision) || fallbackDecisionId;
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

  const legacyResponse = {
    decisionId,
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
      factors: explanationFactors(decision),
    },
    trust: trustRecord ? trustReferenceFor(trustRecord) : undefined,
  };

  if (!canonicalOptions) return legacyResponse;

  const canonical = createCanonicalDecisionResponse({
    decision,
    normalizedRequest: canonicalOptions.normalizedRequest,
    decisionId,
    trustRecord,
    latency: canonicalOptions.latency,
  });

  return {
    ...legacyResponse,
    ...canonical,
    confidence: legacyResponse.confidence,
    confidenceLabel: canonical.confidence.label,
    decisionConfidence: canonical.confidence,
  };
}

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Rewardly Public API",
      version: "1.0.0",
      description:
        "Versioned API for wallet-first payment decisions. This document is colocated with the V1 route contract.",
    },
    paths: {
      "/api/v1/payment-decisions": {
        post: {
          summary: "Create a payment decision",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentDecisionRequest" },
                examples: {
                  successfulPaymentDecision: {
                    summary: "Successful payment decision",
                    value: {
                      merchant: { name: "Amazon", category: "online_retail" },
                      purchase: { amount: 142.83, currency: "USD" },
                      wallet: {
                        cards: [
                          { cardId: "amex-gold" },
                          { cardId: "chase-sapphire-preferred" },
                        ],
                      },
                    },
                  },
                  emptyWallet: {
                    summary: "Empty wallet",
                    value: {
                      merchant: { name: "Amazon", category: "online_retail" },
                      purchase: { amount: 142.83, currency: "USD" },
                      wallet: { cards: [] },
                    },
                  },
                  unknownMerchant: {
                    summary: "Unknown merchant",
                    value: {
                      merchant: { name: "Unknown Shop" },
                      purchase: { amount: 42, currency: "USD" },
                      wallet: { cards: [{ cardId: "capital-one-venture" }] },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Payment decision response",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PaymentDecisionResponse",
                  },
                  examples: {
                    recommended: {
                      summary: "Recommended payment method",
                      value: {
                        decisionId: "pdec_9f1b8de2-df2e-4891-9ac4-b7a1fd8c924d",
                        status: "recommended",
                        recommendedPaymentMethod: {
                          cardId: "capital-one-venture",
                          displayName: "Capital One Venture Rewards",
                        },
                        reason:
                          "Highest verified earning rate among the eligible cards in your wallet.",
                        estimatedValue: 2.86,
                        currency: "USD",
                        confidence: 0.77,
                        explanation: {
                          summary:
                            "Highest verified earning rate among the eligible cards in your wallet.",
                          factors: [
                            "Earn 2x Venture Miles on this Amazon purchase.",
                            "2x miles on every purchase",
                          ],
                        },
                      },
                    },
                    emptyWallet: {
                      summary: "No recommendation for empty wallet",
                      value: {
                        decisionId: "pdec_1d02f0dc-5bda-4b63-8ce8-c4bb2c674338",
                        status: "no_recommendation",
                        recommendedPaymentMethod: null,
                        reason:
                          "Add cards to your wallet to get personalized recommendations.",
                        estimatedValue: null,
                        currency: "USD",
                        confidence: 0,
                        explanation: {
                          summary:
                            "Add cards to your wallet to get personalized recommendations.",
                          factors: [],
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    missingAmount: {
                      value: {
                        error: {
                          code: "INVALID_REQUEST",
                          message: "purchase.amount is required",
                        },
                      },
                    },
                    duplicateCards: {
                      value: {
                        error: {
                          code: "INVALID_REQUEST",
                          message:
                            "wallet.cards contains duplicate cardId values",
                        },
                      },
                    },
                  },
                },
              },
            },
            "422": {
              description: "Unsupported purchase",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    invalidCurrency: {
                      value: {
                        error: {
                          code: "UNSUPPORTED_PURCHASE",
                          message: "purchase.currency must be USD",
                        },
                      },
                    },
                  },
                },
              },
            },
            "429": {
              description: "Rate limited",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    rateLimited: {
                      value: {
                        error: {
                          code: "RATE_LIMITED",
                          message: "Too many requests. Please try again later.",
                        },
                      },
                    },
                  },
                },
              },
            },
            "500": {
              description: "Engine failure",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    engineFailure: {
                      value: {
                        error: {
                          code: "ENGINE_FAILURE",
                          message:
                            "Rewardly could not create a payment decision.",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/card-catalog": {
        get: {
          summary: "List cards available for developer wallets",
          responses: {
            "200": {
              description: "Card catalog response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CardCatalogResponse" },
                  examples: {
                    catalog: {
                      value: {
                        cards: [
                          {
                            cardId: "capital-one-venture",
                            displayName: "Capital One Venture Rewards",
                            issuer: "Capital One",
                            annualFee: 95,
                            rewardProgram: "Venture Miles",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      ...planningOpenApiPaths(),
      ...financialIntentOpenApiPaths(),
      ...merchantKnowledgeOpenApiPaths(),
      ...decisionTrustOpenApiPaths(),
      ...contextOpenApiPaths(),
      ...partnerOpenApiPaths(),
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "opaque Rewardly access token",
        },
        partnerApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Rewardly partner API key",
        },
        partnerAdminToken: {
          type: "apiKey",
          in: "header",
          name: "X-Rewardly-Admin-Token",
        },
      },
      responses: {
        ...planningOpenApiResponses(),
        ...financialIntentOpenApiResponses(),
        ...merchantKnowledgeOpenApiResponses(),
        ...decisionTrustOpenApiResponses(),
        ...partnerOpenApiResponses(),
      },
      schemas: {
        PaymentDecisionRequest: {
          type: "object",
          additionalProperties: false,
          required: ["merchant", "purchase", "wallet"],
          properties: {
            merchant: {
              type: "object",
              additionalProperties: false,
              required: ["name"],
              properties: {
                name: {
                  type: "string",
                  minLength: 1,
                  maxLength: 160,
                  example: "Amazon",
                },
                category: {
                  type: "string",
                  maxLength: 160,
                  example: "online_retail",
                },
                domain: {
                  type: "string",
                  maxLength: 160,
                  example: "amazon.com",
                },
                mcc: { type: "string", maxLength: 160, example: "5942" },
              },
            },
            purchase: {
              type: "object",
              additionalProperties: false,
              required: ["amount", "currency"],
              properties: {
                amount: {
                  type: "number",
                  exclusiveMinimum: 0,
                  example: 142.83,
                },
                currency: { type: "string", enum: ["USD"], example: "USD" },
              },
            },
            wallet: {
              type: "object",
              additionalProperties: false,
              required: ["cards"],
              properties: {
                cards: {
                  type: "array",
                  maxItems: 30,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["cardId"],
                    properties: {
                      cardId: {
                        type: "string",
                        minLength: 1,
                        maxLength: 80,
                        example: "amex-gold",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        PaymentDecisionResponse: {
          type: "object",
          required: [
            "decisionId",
            "status",
            "recommendedPaymentMethod",
            "reason",
            "estimatedValue",
            "currency",
            "confidence",
            "explanation",
          ],
          properties: {
            decisionId: { type: "string" },
            status: {
              type: "string",
              enum: ["recommended", "no_recommendation"],
            },
            recommendedPaymentMethod: {
              type: ["object", "null"],
              properties: {
                cardId: { type: "string" },
                displayName: { type: "string" },
              },
            },
            reason: { type: "string" },
            estimatedValue: { type: ["number", "null"] },
            currency: { type: "string", enum: ["USD"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            confidenceLabel: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            decisionConfidence: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 1 },
                label: { type: "string", enum: ["high", "medium", "low"] },
              },
            },
            confidenceFactors: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "level", "score", "explanation"],
                properties: {
                  name: { type: "string" },
                  level: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                  },
                  score: { type: ["number", "null"], minimum: 0, maximum: 1 },
                  explanation: { type: "string" },
                },
              },
            },
            recommendation: {
              type: "object",
              properties: {
                paymentMethodId: { type: ["string", "null"] },
                displayName: { type: ["string", "null"] },
                estimatedValue: { type: ["number", "null"] },
                currency: { type: "string", enum: ["USD"] },
                winningRule: { type: ["string", "null"] },
              },
            },
            alternatives: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  paymentMethodId: { type: "string" },
                  displayName: { type: "string" },
                  rank: { type: "number" },
                  estimatedValue: { type: ["number", "null"] },
                  confidence: { type: ["number", "null"] },
                  reasonNotSelected: { type: "string" },
                  supportingEvidence: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
            explanation: {
              type: "object",
              properties: {
                summary: { type: "string" },
                factors: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  evidenceId: { type: "string" },
                  type: { type: "string" },
                  source: { type: "string" },
                  statement: { type: "string" },
                  effect: { type: "string" },
                  confidence: { type: ["number", "null"] },
                  version: { type: ["string", "null"] },
                },
              },
            },
            warnings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  severity: { type: "string" },
                  message: { type: "string" },
                  userAction: { type: "string" },
                },
              },
            },
            requestId: { type: "string" },
            merchant: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: { type: ["string", "null"] },
                confidence: { type: ["number", "null"] },
              },
            },
            walletSnapshot: {
              type: "object",
              properties: {
                source: { type: "string" },
                cardSlugs: {
                  type: "array",
                  items: { type: "string" },
                },
                evaluatedCardCount: { type: "number" },
              },
            },
            purchaseContext: {
              type: "object",
              properties: {
                amount: { type: ["number", "null"] },
                currency: { type: "string", enum: ["USD"] },
                checkoutStage: { type: ["string", "null"] },
                context: {},
              },
            },
            ruleVersion: { type: "string" },
            merchantRegistryVersion: { type: "string" },
            benefitRegistryVersion: { type: "string" },
            knowledgeVersion: { type: "string" },
            decisionEngineVersion: { type: "string" },
            generatedAt: { type: "string" },
            latency: {
              type: "object",
              properties: {
                merchantResolutionMs: { type: ["number", "null"] },
                engineMs: { type: "number" },
                evidenceGenerationMs: { type: "number" },
                totalMs: { type: "number" },
              },
            },
            replayAvailable: { type: "boolean" },
            trust: {
              type: "object",
              properties: {
                trustRecordId: { type: "string" },
                status: {
                  type: "string",
                  enum: ["complete", "partial", "unavailable"],
                },
                evidenceUrl: { type: "string" },
                trustUrl: { type: "string" },
                replayable: { type: "boolean" },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", example: "INVALID_REQUEST" },
                message: {
                  type: "string",
                  example: "merchant.name is required",
                },
              },
            },
          },
        },
        CardCatalogResponse: {
          type: "object",
          required: ["cards"],
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                required: ["cardId", "displayName"],
                properties: {
                  cardId: { type: "string", example: "capital-one-venture" },
                  displayName: {
                    type: "string",
                    example: "Capital One Venture Rewards",
                  },
                  issuer: { type: ["string", "null"], example: "Capital One" },
                  annualFee: { type: ["number", "null"], example: 95 },
                  rewardProgram: {
                    type: ["string", "null"],
                    example: "Venture Miles",
                  },
                },
              },
            },
          },
        },
        ...planningOpenApiSchemas(),
        ...financialIntentOpenApiSchemas(),
        ...merchantKnowledgeOpenApiSchemas(),
        ...decisionTrustOpenApiSchemas(),
        ...contextOpenApiSchemas(),
        ...partnerOpenApiSchemas(),
      },
    },
  };
}

function invalid(message: string): ValidationResult {
  return {
    ok: false,
    status: 400,
    code: "INVALID_REQUEST",
    message,
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCardId(value: unknown) {
  return cleanString(value).toLowerCase().replace(/_/g, "-");
}

function unknownKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  label: string,
) {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (!unknown.length) return null;
  return `${label} contains unsupported field: ${unknown[0]}`;
}

function confidenceScoreFromLabel(
  label: PaymentDecision["confidence"]["label"],
) {
  if (label === "high") return 0.9;
  if (label === "medium") return 0.7;
  if (label === "low") return 0.45;
  return 0;
}

async function optionalAuthUser(authorizationHeader?: string) {
  if (!authorizationHeader) return null;
  try {
    return await authenticateAccessToken(authorizationHeader);
  } catch {
    return null;
  }
}

function explanationFactors(decision: PaymentDecision) {
  const narrativeFactors =
    decision.decisionNarrative?.supportingReasons?.map(
      (reason) => reason.summary,
    ) || [];
  const fallbackFactors = [
    decision.winningReason?.explanation,
    decision.primaryReason?.detail,
    ...(decision.unlockedBenefits || []).map((benefit) => benefit.summary),
  ].filter(Boolean) as string[];
  return Array.from(new Set([...narrativeFactors, ...fallbackFactors]))
    .filter((factor) => typeof factor === "string" && factor.trim())
    .map((factor) => factor.trim())
    .slice(0, 4);
}

export function createPublicDecisionId() {
  return `pdec_${crypto.randomUUID()}`;
}

function publicDecisionIdFromDecision(decision: PaymentDecision) {
  const candidates = [
    (decision.decisionExplanation as any)?.decisionId,
    (decision as any).auditLog?.decisionId,
  ];
  return candidates.find(
    (candidate) =>
      typeof candidate === "string" && /^pdec_[\w-]+$/.test(candidate),
  );
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function firstNonEmptyString(values: Array<unknown>) {
  return values
    .find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    ?.trim();
}

function rewardProgramForCatalogCard(card: any) {
  const text =
    `${card.name || ""} ${(card.perks || []).join(" ")}`.toLowerCase();
  if (/venture/.test(text)) return "Venture Miles";
  if (/membership rewards|amex|american express/.test(text))
    return "Membership Rewards";
  if (/ultimate rewards|chase/.test(text)) return "Ultimate Rewards";
  if (/thankyou|citi/.test(text)) return "ThankYou Points";
  if (/cash/.test(text)) return "Cash Back";
  return null;
}
