import { Router } from "express";
import {
  addPlanItem,
  createShoppingPlan,
  deleteShoppingPlan,
  getShoppingPlan,
  listShoppingPlans,
  markPlanItemComplete,
  optimizeShoppingPlan,
  updateShoppingPlan,
  type PlanningError,
} from "../../services/planningService";

const router = Router();

router.post("/plans", (req, res) => {
  const result = createShoppingPlan(req.body);
  if (isPlanningError(result)) return sendPlanningError(res, result);
  return res.status(201).json({ plan: result });
});

router.get("/plans", (_req, res) => {
  res.json({ plans: listShoppingPlans() });
});

router.get("/plans/:planId", (req, res) => {
  const plan = getShoppingPlan(req.params.planId);
  if (!plan) {
    return sendPlanningError(res, {
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "plan not found",
    });
  }
  return res.json({ plan });
});

router.patch("/plans/:planId", (req, res) => {
  const result = updateShoppingPlan(req.params.planId, req.body);
  if (isPlanningError(result)) return sendPlanningError(res, result);
  return res.json({ plan: result });
});

router.delete("/plans/:planId", (req, res) => {
  if (!deleteShoppingPlan(req.params.planId)) {
    return sendPlanningError(res, {
      status: 404,
      code: "PLAN_NOT_FOUND",
      message: "plan not found",
    });
  }
  return res.status(204).send();
});

router.post("/plans/:planId/items", (req, res) => {
  const result = addPlanItem(req.params.planId, req.body);
  if (isPlanningError(result)) return sendPlanningError(res, result);
  return res.status(201).json({ item: result });
});

router.patch("/plans/:planId/items/:itemId", (req, res) => {
  const result = markPlanItemComplete(req.params.planId, req.params.itemId, req.body);
  if (isPlanningError(result)) return sendPlanningError(res, result);
  return res.json({ item: result });
});

router.post("/plans/:planId/optimize", async (req, res) => {
  const result = await optimizeShoppingPlan(req.params.planId, req.body);
  if (isPlanningError(result)) return sendPlanningError(res, result);
  return res.json(result);
});

export default router;

function isPlanningError(value: any): value is PlanningError {
  return Boolean(value && typeof value.status === "number" && value.code);
}

function sendPlanningError(res: any, error: PlanningError) {
  return res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
    },
  });
}

export function planningOpenApiPaths() {
  return {
    "/api/v1/plans": {
      post: {
        summary: "Create a shopping plan",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePlanRequest" },
              examples: {
                saturdayShopping: {
                  value: {
                    title: "Saturday Shopping",
                    notes: "Target, Costco, and coffee stop",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created shopping plan",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlanResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/InvalidRequest" },
        },
      },
      get: {
        summary: "List shopping plans",
        responses: {
          "200": {
            description: "Shopping plans",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlanListResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/plans/{planId}": {
      get: {
        summary: "Get a shopping plan",
        parameters: [planIdParameter()],
        responses: {
          "200": {
            description: "Shopping plan",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlanResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/PlanNotFound" },
        },
      },
      patch: {
        summary: "Update a shopping plan",
        parameters: [planIdParameter()],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePlanRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated shopping plan",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlanResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/PlanNotFound" },
        },
      },
      delete: {
        summary: "Delete a shopping plan",
        parameters: [planIdParameter()],
        responses: {
          "204": { description: "Deleted" },
          "404": { $ref: "#/components/responses/PlanNotFound" },
        },
      },
    },
    "/api/v1/plans/{planId}/items": {
      post: {
        summary: "Add a planned purchase",
        parameters: [planIdParameter()],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddPlanItemRequest" },
              examples: {
                target: {
                  value: {
                    merchant: { name: "Target", category: "general_retail" },
                    purchase: { amount: 84.22, currency: "USD" },
                    notes: "Household supplies",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created planned purchase",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlanItemResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/InvalidRequest" },
          "404": { $ref: "#/components/responses/PlanNotFound" },
        },
      },
    },
    "/api/v1/plans/{planId}/items/{itemId}": {
      patch: {
        summary: "Mark a planned purchase complete",
        parameters: [
          planIdParameter(),
          {
            name: "itemId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  decisionId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Completed planned purchase",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlanItemResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/PlanNotFound" },
        },
      },
    },
    "/api/v1/plans/{planId}/optimize": {
      post: {
        summary: "Optimize a shopping plan",
        parameters: [planIdParameter()],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PlanOptimizeRequest" },
              examples: {
                demoWallet: {
                  value: {
                    wallet: {
                      cards: [
                        { cardId: "amex-gold" },
                        { cardId: "capital-one-venture" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Optimized shopping plan",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PlanOptimizationResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/InvalidRequest" },
          "404": { $ref: "#/components/responses/PlanNotFound" },
          "500": { $ref: "#/components/responses/EngineFailure" },
        },
      },
    },
  };
}

export function planningOpenApiSchemas() {
  return {
    CreatePlanRequest: {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 120 },
        notes: { type: "string", maxLength: 500 },
      },
    },
    UpdatePlanRequest: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", minLength: 1, maxLength: 120 },
        notes: { type: "string", maxLength: 500 },
        status: { type: "string", enum: ["active", "completed"] },
      },
    },
    AddPlanItemRequest: {
      type: "object",
      additionalProperties: false,
      required: ["merchant", "purchase"],
      properties: {
        merchant: { $ref: "#/components/schemas/PlannedMerchant" },
        purchase: { $ref: "#/components/schemas/PlannedPurchase" },
        notes: { type: "string", maxLength: 500 },
      },
    },
    PlanOptimizeRequest: {
      type: "object",
      additionalProperties: false,
      required: ["wallet"],
      properties: {
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
                  cardId: { type: "string", minLength: 1, maxLength: 80 },
                },
              },
            },
          },
        },
      },
    },
    PlannedMerchant: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 160 },
        category: { type: "string", maxLength: 160 },
        domain: { type: "string", maxLength: 160 },
      },
    },
    PlannedPurchase: {
      type: "object",
      additionalProperties: false,
      required: ["amount", "currency"],
      properties: {
        amount: { type: "number", exclusiveMinimum: 0 },
        currency: { type: "string", enum: ["USD"] },
      },
    },
    ShoppingPlan: {
      type: "object",
      required: ["planId", "title", "status", "currency", "items"],
      properties: {
        planId: { type: "string" },
        title: { type: "string" },
        notes: { type: "string" },
        status: { type: "string", enum: ["active", "completed"] },
        currency: { type: "string", enum: ["USD"] },
        items: { type: "array", items: { $ref: "#/components/schemas/PlanItem" } },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
      },
    },
    PlanItem: {
      type: "object",
      required: ["itemId", "merchant", "purchase", "completionState"],
      properties: {
        itemId: { type: "string" },
        merchant: { $ref: "#/components/schemas/PlannedMerchant" },
        purchase: { $ref: "#/components/schemas/PlannedPurchase" },
        notes: { type: "string" },
        completionState: { type: "string", enum: ["planned", "completed"] },
        completedAt: { type: "string" },
        completedDecisionId: { type: "string" },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
      },
    },
    PlanResponse: {
      type: "object",
      required: ["plan"],
      properties: { plan: { $ref: "#/components/schemas/ShoppingPlan" } },
    },
    PlanListResponse: {
      type: "object",
      required: ["plans"],
      properties: {
        plans: { type: "array", items: { $ref: "#/components/schemas/ShoppingPlan" } },
      },
    },
    PlanItemResponse: {
      type: "object",
      required: ["item"],
      properties: { item: { $ref: "#/components/schemas/PlanItem" } },
    },
    PlanOptimizationResponse: {
      type: "object",
      required: ["planId", "title", "estimatedTotalRewards", "optimizedItems"],
      properties: {
        planId: { type: "string" },
        title: { type: "string" },
        estimatedTotalRewards: { type: ["number", "null"] },
        currency: { type: "string", enum: ["USD"] },
        optimizedItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              merchant: { $ref: "#/components/schemas/PlannedMerchant" },
              purchase: { $ref: "#/components/schemas/PlannedPurchase" },
              completionState: { type: "string" },
              decision: { $ref: "#/components/schemas/PaymentDecisionResponse" },
            },
          },
        },
        opportunitySummary: { type: "string" },
        progress: {
          type: "object",
          properties: {
            plannedPurchases: { type: "number" },
            completedPurchases: { type: "number" },
            remainingPurchases: { type: "number" },
            estimatedRewardsEarned: { type: "number" },
            estimatedRewardsRemaining: { type: "number" },
          },
        },
      },
    },
  };
}

export function planningOpenApiResponses() {
  return {
    InvalidRequest: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    PlanNotFound: {
      description: "Plan not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
    EngineFailure: {
      description: "Engine failure",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
      },
    },
  };
}

function planIdParameter() {
  return {
    name: "planId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };
}
