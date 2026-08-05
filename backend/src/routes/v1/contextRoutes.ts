import { Router } from "express";
import {
  requireAuthenticatedUser,
  sendAuthError,
  type AuthenticatedRequest,
} from "../../middleware/productionAuth";
import {
  DECISION_POLICIES,
  getContextPreferences,
  getUserContext,
  normalizeDecisionContext,
  updateContextPreferences,
} from "../../services/contextInfrastructureService";

const router = Router();

router.post("/context/validate", (req, res) => {
  const result = normalizeDecisionContext(req.body);
  return res.status(result.valid ? 200 : 400).json(result);
});

router.get("/decision-policies", (_req, res) => {
  res.json({ policies: DECISION_POLICIES });
});

router.use(requireAuthenticatedUser);

router.get(
  "/context",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({ context: await getUserContext(req.authUser!.userId) });
  }),
);

router.post(
  "/context",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const preferences = await getContextPreferences(req.authUser!.userId);
    const result = normalizeDecisionContext({
      ...req.body,
      preferences: req.body?.preferences || preferences.preferences,
      constraints: req.body?.constraints || preferences.constraints,
      decisionPolicy: req.body?.decisionPolicy || preferences.decisionPolicy,
    });
    return res.status(result.valid ? 200 : 400).json(result);
  }),
);

router.get(
  "/preferences",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({
      preferences: await getContextPreferences(req.authUser!.userId),
    });
  }),
);

router.patch(
  "/preferences",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({
      preferences: await updateContextPreferences(
        req.authUser!.userId,
        req.body,
      ),
    });
  }),
);

export default router;

function asyncHandler(
  handler: (req: AuthenticatedRequest, res: any) => Promise<any>,
) {
  return async (req: AuthenticatedRequest, res: any) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return sendAuthError(res, error, req.requestId || "req_unknown");
    }
  };
}

export function contextOpenApiPaths() {
  return {
    "/api/v1/context/validate": {
      post: {
        summary: "Validate and normalize decision context",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ContextInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Valid canonical context",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ContextValidationResult",
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/InvalidRequest" },
        },
      },
    },
    "/api/v1/context": {
      get: {
        summary: "Get the authenticated user's default decision context",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Canonical user context",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ContextResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/AuthenticationRequired" },
        },
      },
      post: {
        summary: "Normalize context for the authenticated user",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ContextInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Canonical context",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ContextValidationResult",
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/InvalidRequest" },
          "401": { $ref: "#/components/responses/AuthenticationRequired" },
        },
      },
    },
    "/api/v1/decision-policies": {
      get: {
        summary: "List supported decision policies",
        responses: {
          "200": {
            description: "Decision policies",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DecisionPoliciesResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/preferences": {
      get: {
        summary: "Get canonical decision preferences",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Context preferences",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ContextPreferencesResponse",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/AuthenticationRequired" },
        },
      },
      patch: {
        summary: "Update canonical decision preferences",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ContextPreferencesInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated context preferences",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ContextPreferencesResponse",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/AuthenticationRequired" },
        },
      },
    },
  };
}

export function contextOpenApiSchemas() {
  return {
    ContextInput: {
      type: "object",
      additionalProperties: true,
      properties: {
        purchase: { type: "object" },
        wallet: { type: "object" },
        financialIntent: { type: "object" },
        decisionPolicy: {
          oneOf: [
            { type: "string" },
            { $ref: "#/components/schemas/DecisionPolicy" },
          ],
        },
        preferences: {
          type: "array",
          items: { $ref: "#/components/schemas/ContextPreference" },
        },
        constraints: {
          type: "array",
          items: { $ref: "#/components/schemas/ContextConstraint" },
        },
      },
    },
    ContextValidationResult: {
      type: "object",
      required: ["valid", "errors", "warnings"],
      properties: {
        valid: { type: "boolean" },
        context: { $ref: "#/components/schemas/CanonicalContext" },
        errors: {
          type: "array",
          items: { $ref: "#/components/schemas/ContextValidationError" },
        },
        warnings: { type: "array", items: { type: "string" } },
      },
    },
    ContextValidationError: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        field: { type: "string" },
      },
    },
    ContextResponse: {
      type: "object",
      properties: {
        context: { $ref: "#/components/schemas/CanonicalContext" },
      },
    },
    CanonicalContext: {
      type: "object",
      required: [
        "contextId",
        "schemaVersion",
        "purchase",
        "user",
        "financialIntent",
        "decisionPolicy",
        "normalization",
      ],
      properties: {
        contextId: { type: "string" },
        schemaVersion: { type: "string" },
        purchase: { type: "object" },
        user: { type: "object" },
        financialIntent: { type: "object" },
        decisionPolicy: { $ref: "#/components/schemas/DecisionPolicy" },
        normalization: { type: "object" },
      },
    },
    DecisionPolicy: {
      type: "object",
      required: [
        "policyId",
        "displayName",
        "objective",
        "priority",
        "description",
        "version",
      ],
      properties: {
        policyId: { type: "string" },
        displayName: { type: "string" },
        objective: { type: "string" },
        priority: { type: "number" },
        description: { type: "string" },
        version: { type: "string" },
      },
    },
    ContextPreference: {
      type: "object",
      required: ["preferenceId", "type", "value", "strength", "source"],
      properties: {
        preferenceId: { type: "string" },
        type: { type: "string" },
        value: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        },
        threshold: { type: "number" },
        strength: { type: "string", enum: ["soft", "strong"] },
        source: { type: "string", enum: ["user", "partner", "default"] },
      },
    },
    ContextConstraint: {
      type: "object",
      required: ["constraintId", "type", "value", "severity", "source"],
      properties: {
        constraintId: { type: "string" },
        type: { type: "string" },
        value: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        },
        severity: { type: "string", enum: ["hard", "soft"] },
        source: { type: "string", enum: ["user", "partner", "platform"] },
      },
    },
    DecisionPoliciesResponse: {
      type: "object",
      properties: {
        policies: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionPolicy" },
        },
      },
    },
    ContextPreferencesInput: {
      type: "object",
      properties: {
        preferences: {
          type: "array",
          items: { $ref: "#/components/schemas/ContextPreference" },
        },
        constraints: {
          type: "array",
          items: { $ref: "#/components/schemas/ContextConstraint" },
        },
        decisionPolicy: {
          oneOf: [
            { type: "string" },
            { $ref: "#/components/schemas/DecisionPolicy" },
          ],
        },
      },
    },
    ContextPreferencesResponse: {
      type: "object",
      properties: {
        preferences: { type: "object" },
      },
    },
  };
}
