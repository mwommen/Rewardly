import {
  planningOpenApiPaths,
  planningOpenApiResponses,
  planningOpenApiSchemas,
} from "../planningRoutes";
import {
  financialIntentOpenApiPaths,
  financialIntentOpenApiResponses,
  financialIntentOpenApiSchemas,
} from "../financialIntentRoutes";
import {
  merchantKnowledgeOpenApiPaths,
  merchantKnowledgeOpenApiResponses,
  merchantKnowledgeOpenApiSchemas,
} from "../merchantKnowledgeRoutes";
import {
  decisionTrustOpenApiPaths,
  decisionTrustOpenApiResponses,
  decisionTrustOpenApiSchemas,
} from "../decisionTrustRoutes";
import { contextOpenApiPaths, contextOpenApiSchemas } from "../contextRoutes";
import {
  partnerOpenApiPaths,
  partnerOpenApiResponses,
  partnerOpenApiSchemas,
} from "../partnerRoutes";

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
      ...decisionRuntimeOpenApiPaths(),
      ...decisionValidationOpenApiPaths(),
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
            lifecycleStatus: {
              type: "string",
              enum: [
                "received",
                "evaluating",
                "recommended",
                "persisted",
                "replayable",
                "accepted",
                "rejected",
                "expired",
                "validated",
                "superseded",
                "archived",
              ],
            },
            runtimeVersion: { type: "string" },
            replayStatus: {
              type: "string",
              enum: ["replayable", "not_replayable"],
            },
            eventCount: { type: "number" },
            validationStatus: {
              type: "string",
              enum: [
                "pending",
                "validated",
                "needs_review",
                "superseded",
                "archived",
              ],
            },
            validationId: { type: ["string", "null"] },
            trustScore: { type: ["number", "null"], minimum: 0, maximum: 100 },
            trustScoreLevel: {
              type: ["string", "null"],
              enum: ["excellent", "strong", "moderate", "weak", null],
            },
            validatedAt: { type: ["string", "null"], format: "date-time" },
            validation: { $ref: "#/components/schemas/ValidationResult" },
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
        DecisionRuntimeObject: {
          allOf: [
            { $ref: "#/components/schemas/PaymentDecisionResponse" },
            {
              type: "object",
              required: [
                "id",
                "status",
                "runtimeVersion",
                "createdAt",
                "updatedAt",
                "eventCount",
                "history",
              ],
              properties: {
                id: { type: "string" },
                userId: { type: ["string", "null"] },
                partnerId: { type: ["string", "null"] },
                status: {
                  type: "string",
                  enum: [
                    "received",
                    "evaluating",
                    "recommended",
                    "persisted",
                    "replayable",
                    "accepted",
                    "rejected",
                    "expired",
                    "validated",
                    "superseded",
                    "archived",
                  ],
                },
                runtimeVersion: { type: "string" },
                apiVersion: { type: "string" },
                decisionPolicy: { type: "string" },
                replayStatus: {
                  type: "string",
                  enum: ["replayable", "not_replayable"],
                },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                eventCount: { type: "number" },
                history: {
                  type: "array",
                  items: { $ref: "#/components/schemas/DecisionRuntimeEvent" },
                },
              },
            },
          ],
        },
        DecisionRuntimeEvent: {
          type: "object",
          required: [
            "eventId",
            "decisionId",
            "type",
            "component",
            "timestamp",
            "durationMs",
            "metadata",
          ],
          properties: {
            eventId: { type: "string" },
            decisionId: { type: "string" },
            type: { type: "string" },
            component: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            durationMs: { type: ["number", "null"] },
            metadata: { type: "object" },
          },
        },
        ValidationResult: {
          type: "object",
          required: [
            "validationId",
            "decisionId",
            "status",
            "validatedAt",
            "validatorVersion",
            "overallResult",
            "trustScore",
            "trustScoreLevel",
            "confidenceCalibration",
            "evidenceCompleteness",
            "recommendationCorrectness",
            "ruleConsistency",
            "merchantResolutionQuality",
            "walletCoverage",
            "warnings",
            "validationNotes",
            "createdAt",
          ],
          properties: {
            validationId: { type: "string" },
            decisionId: { type: "string" },
            status: {
              type: "string",
              enum: [
                "pending",
                "validated",
                "needs_review",
                "superseded",
                "archived",
              ],
            },
            validatedAt: { type: "string", format: "date-time" },
            validatorVersion: { type: "string" },
            overallResult: {
              type: "string",
              enum: ["passed", "warning", "failed"],
            },
            trustScore: { type: "number", minimum: 0, maximum: 100 },
            trustScoreLevel: {
              type: "string",
              enum: ["excellent", "strong", "moderate", "weak"],
            },
            confidenceCalibration: {
              $ref: "#/components/schemas/ValidationMetric",
            },
            evidenceCompleteness: {
              $ref: "#/components/schemas/ValidationMetric",
            },
            recommendationCorrectness: {
              $ref: "#/components/schemas/ValidationMetric",
            },
            ruleConsistency: {
              $ref: "#/components/schemas/ValidationMetric",
            },
            merchantResolutionQuality: {
              $ref: "#/components/schemas/ValidationMetric",
            },
            walletCoverage: {
              $ref: "#/components/schemas/ValidationMetric",
            },
            warnings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  severity: {
                    type: "string",
                    enum: ["info", "caution", "critical"],
                  },
                  message: { type: "string" },
                  component: { type: "string" },
                },
              },
            },
            validationNotes: {
              type: "array",
              items: { type: "string" },
            },
            edgeCases: {
              type: "array",
              items: { type: "string" },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ValidationMetric: {
          type: "object",
          required: ["score", "result", "notes"],
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            result: {
              type: "string",
              enum: ["passed", "warning", "failed"],
            },
            notes: {
              type: "array",
              items: { type: "string" },
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

function decisionRuntimeOpenApiPaths() {
  const decisionIdParameter = {
    name: "decisionId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };
  return {
    "/api/v1/decisions/{decisionId}": {
      get: {
        summary: "Get a persistent decision runtime object",
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision runtime object",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decision"],
                  properties: {
                    decision: {
                      $ref: "#/components/schemas/DecisionRuntimeObject",
                    },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/DecisionNotFound" },
        },
      },
    },
    "/api/v1/decisions/{decisionId}/events": {
      get: {
        summary: "Get decision runtime events",
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision runtime event stream",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decisionId", "events", "eventCount"],
                  properties: {
                    decisionId: { type: "string" },
                    events: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/DecisionRuntimeEvent",
                      },
                    },
                    eventCount: { type: "number" },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/DecisionNotFound" },
        },
      },
    },
    "/api/v1/decisions/{decisionId}/replay": {
      post: {
        summary: "Replay a persistent decision",
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision replay result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decisionId", "replay", "runtimeEvent"],
                  properties: {
                    decisionId: { type: "string" },
                    replay: {
                      $ref: "#/components/schemas/DecisionReplayResult",
                    },
                    runtimeEvent: {
                      $ref: "#/components/schemas/DecisionRuntimeEvent",
                    },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/DecisionNotFound" },
          "500": {
            description: "Replay failure",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  };
}

function decisionValidationOpenApiPaths() {
  const decisionIdParameter = {
    name: "decisionId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };
  const validationIdParameter = {
    name: "validationId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };
  const validationResponse = {
    "200": {
      description: "Decision validation result",
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["validation"],
            properties: {
              validation: { $ref: "#/components/schemas/ValidationResult" },
            },
          },
        },
      },
    },
    "404": {
      description: "Validation not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
  };
  return {
    "/api/v1/validations/{validationId}": {
      get: {
        summary: "Get a decision validation result",
        parameters: [validationIdParameter],
        responses: validationResponse,
      },
    },
    "/api/v1/decisions/{decisionId}/validation": {
      get: {
        summary: "Get validation for a decision",
        parameters: [decisionIdParameter],
        responses: validationResponse,
      },
    },
    "/api/v1/decisions/{decisionId}/validate": {
      post: {
        summary: "Validate a replayable decision",
        parameters: [decisionIdParameter],
        responses: validationResponse,
      },
    },
  };
}

