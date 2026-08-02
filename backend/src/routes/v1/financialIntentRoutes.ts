import { Router } from "express";
import {
  executeFinancialIntent,
  getFinancialIntent,
  listFinancialIntentEvents,
  type FinancialIntentError,
} from "../../services/financialIntentService";

const router = Router();

router.post("/intents", async (req, res) => {
  const result = await executeFinancialIntent(req.body);
  if (isIntentError(result)) {
    return res.status(result.status).json({
      error: {
        code: result.code,
        message: result.message,
      },
    });
  }
  return res.status(result.metadata.success ? 200 : 400).json(result);
});

router.get("/intents/:intentId", (req, res) => {
  const intent = getFinancialIntent(req.params.intentId);
  if (!intent) {
    return res.status(404).json({
      error: {
        code: "INTENT_NOT_FOUND",
        message: "intent not found",
      },
    });
  }
  return res.json(intent);
});

router.get("/intent-events", (_req, res) => {
  res.json({ events: listFinancialIntentEvents() });
});

export default router;

function isIntentError(value: any): value is FinancialIntentError {
  return Boolean(value && typeof value.status === "number" && value.code);
}

export function financialIntentOpenApiPaths() {
  return {
    "/api/v1/intents": {
      post: {
        summary: "Execute a financial intent",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/FinancialIntentRequest" },
              examples: {
                smartPay: {
                  value: {
                    type: "SMART_PAY",
                    payload: {
                      merchant: { name: "Amazon", category: "online_retail" },
                      purchase: { amount: 142.83, currency: "USD" },
                      wallet: { cards: [{ cardId: "capital-one-venture" }] },
                    },
                  },
                },
                planPurchases: {
                  value: {
                    type: "PLAN_PURCHASES",
                    payload: {
                      planId: "plan_...",
                      wallet: { cards: [{ cardId: "amex-gold" }] },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Unified financial intent response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FinancialIntentResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/InvalidRequest" },
          "500": { $ref: "#/components/responses/EngineFailure" },
        },
      },
    },
    "/api/v1/intents/{intentId}": {
      get: {
        summary: "Get a previously executed intent",
        parameters: [
          {
            name: "intentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Financial intent response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FinancialIntentResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/IntentNotFound" },
        },
      },
    },
  };
}

export function financialIntentOpenApiSchemas() {
  return {
    FinancialIntentRequest: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: {
          type: "string",
          enum: [
            "SMART_PAY",
            "PLAN_PURCHASES",
            "COMPLETE_PURCHASE",
            "REVIEW_PAYMENT_HISTORY",
            "VIEW_WALLET_COACH",
            "VIEW_OPPORTUNITIES",
            "VIEW_WEEKLY_SUMMARY",
          ],
        },
        requestId: { type: "string" },
        payload: { type: "object" },
        metadata: { type: "object" },
      },
    },
    FinancialIntentResponse: {
      type: "object",
      required: [
        "intentId",
        "requestId",
        "timestamp",
        "intentType",
        "executedCapabilities",
        "result",
        "warnings",
        "errors",
        "metadata",
      ],
      properties: {
        intentId: { type: "string" },
        requestId: { type: "string" },
        timestamp: { type: "string" },
        intentType: { type: "string" },
        executedCapabilities: {
          type: "array",
          items: { type: "string" },
        },
        result: {},
        warnings: {
          type: "array",
          items: { type: "string" },
        },
        errors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
        metadata: {
          type: "object",
          properties: {
            executionTimeMs: { type: "number" },
            success: { type: "boolean" },
          },
        },
      },
    },
  };
}

export function financialIntentOpenApiResponses() {
  return {
    IntentNotFound: {
      description: "Intent not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
  };
}
