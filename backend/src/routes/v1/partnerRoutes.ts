import { Router, type NextFunction, type Response } from "express";
import {
  requirePartnerApiKey,
  sendPartnerError,
  type PartnerRequest,
} from "../../middleware/partnerAuth";
import {
  createPartnerApiKey,
  createPartnerOrganization,
  createPartnerProject,
  getPartnerUsageSummary,
  revokePartnerApiKey,
  rotatePartnerApiKey,
} from "../../services/partnerPlatformService";
import {
  decidePayment,
  type PaymentDecisionRequest,
} from "../../services/paymentDecisionService";
import {
  createOrResolveTrustRecord,
  trustReferenceFor,
} from "../../services/trustInfrastructureService";
import {
  createPublicDecisionId,
  toV1PaymentDecisionResponse,
  validatePaymentDecisionRequest,
} from "./paymentDecisionRoutes";

const router = Router();

router.post(
  "/partner/organizations",
  requirePartnerBootstrapAdmin,
  asyncHandler(async (req, res) => {
    const organization = await createPartnerOrganization(req.body);
    return res.status(201).json({ organization });
  }),
);

router.post(
  "/partner/projects",
  requirePartnerBootstrapAdmin,
  asyncHandler(async (req, res) => {
    const project = await createPartnerProject(req.body);
    return res.status(201).json({ project });
  }),
);

router.post(
  "/partner/api-keys",
  requirePartnerBootstrapAdmin,
  asyncHandler(async (req, res) => {
    const result = await createPartnerApiKey(req.body);
    return res.status(201).json(result);
  }),
);

router.post(
  "/partner/api-keys/:apiKeyId/rotate",
  requirePartnerBootstrapAdmin,
  asyncHandler(async (req, res) => {
    res.json(await rotatePartnerApiKey(req.params.apiKeyId, req.body?.actor));
  }),
);

router.post(
  "/partner/api-keys/:apiKeyId/revoke",
  requirePartnerBootstrapAdmin,
  asyncHandler(async (req, res) => {
    res.json(await revokePartnerApiKey(req.params.apiKeyId));
  }),
);

router.get(
  "/partner/usage",
  requirePartnerApiKey(["admin"], "admin"),
  asyncHandler(async (req: PartnerRequest, res) => {
    res.json({
      usage: await getPartnerUsageSummary(
        req.partner!.organizationId,
        String(req.query.projectId || "") || undefined,
      ),
    });
  }),
);

router.post(
  "/partner/payment-decisions",
  requirePartnerApiKey(["decision.write"]),
  asyncHandler(async (req: PartnerRequest, res) => {
    const validation = validatePaymentDecisionRequest(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({
        error: {
          code: validation.code,
          message: validation.message,
          requestId: req.requestId,
        },
      });
    }

    const request = validation.value;
    const decisionId = createPublicDecisionId();
    const normalizedDecisionRequest: PaymentDecisionRequest = {
      userId: `partner:${req.partner!.organizationId}:${req.partner!.projectId}:${decisionId}`,
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
      context: {
        ...(request.context || {}),
        tenant: {
          organizationId: req.partner!.organizationId,
          projectId: req.partner!.projectId,
          environment: req.partner!.environment,
        },
      },
    };
    const decision = await decidePayment(normalizedDecisionRequest);
    const trustRecord = await createOrResolveTrustRecord({
      decisionId,
      decision,
      normalizedRequest: normalizedDecisionRequest,
      ownerUserId: null,
      tenantId: `${req.partner!.organizationId}:${req.partner!.projectId}:${req.partner!.environment}`,
    });
    return res.json({
      ...toV1PaymentDecisionResponse(decision, decisionId, trustRecord),
      metadata: {
        requestId: req.requestId,
        correlationId: req.correlationId,
        organizationId: req.partner!.organizationId,
        projectId: req.partner!.projectId,
        environment: req.partner!.environment,
        trust: trustReferenceFor(trustRecord),
      },
    });
  }),
);

export default router;

function requirePartnerBootstrapAdmin(
  req: PartnerRequest,
  res: Response,
  next: NextFunction,
) {
  const configuredToken = process.env.REWARDLY_PARTNER_ADMIN_TOKEN;
  req.requestId = req.requestId || `req_${Date.now().toString(36)}`;
  res.setHeader("X-Request-Id", req.requestId);
  if (!configuredToken && process.env.NODE_ENV !== "production") {
    return next();
  }
  if (!configuredToken) {
    return res.status(503).json({
      error: {
        code: "PARTNER_ADMIN_NOT_CONFIGURED",
        message: "Partner administration is not configured.",
        requestId: req.requestId,
      },
    });
  }
  const suppliedToken = String(req.headers["x-rewardly-admin-token"] || "");
  if (suppliedToken !== configuredToken) {
    return res.status(401).json({
      error: {
        code: "PARTNER_ADMIN_REQUIRED",
        message: "Partner administration requires a valid admin token.",
        requestId: req.requestId,
      },
    });
  }
  return next();
}

function asyncHandler(handler: (req: any, res: any) => Promise<any>) {
  return async (req: PartnerRequest, res: any) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return sendPartnerError(res, error, req.requestId || "req_unknown");
    }
  };
}

export function partnerOpenApiPaths() {
  return {
    "/api/v1/partner/organizations": {
      post: {
        summary: "Create a partner organization",
        security: [{ partnerAdminToken: [] }],
        responses: {
          "201": {
            description: "Partner organization created",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PartnerOrganizationResponse",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/PartnerAdminRequired" },
        },
      },
    },
    "/api/v1/partner/projects": {
      post: {
        summary: "Create a partner project",
        security: [{ partnerAdminToken: [] }],
        responses: {
          "201": {
            description: "Partner project created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PartnerProjectResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/PartnerAdminRequired" },
        },
      },
    },
    "/api/v1/partner/api-keys": {
      post: {
        summary: "Create a partner API key",
        security: [{ partnerAdminToken: [] }],
        responses: {
          "201": {
            description:
              "Partner API key created. Plaintext key is returned once.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PartnerApiKeyCreateResponse",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/PartnerAdminRequired" },
        },
      },
    },
    "/api/v1/partner/api-keys/{apiKeyId}/rotate": {
      post: {
        summary: "Rotate a partner API key",
        security: [{ partnerAdminToken: [] }],
        parameters: [
          {
            name: "apiKeyId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description:
              "Partner API key rotated. Plaintext key is returned once.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PartnerApiKeyCreateResponse",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/PartnerAdminRequired" },
        },
      },
    },
    "/api/v1/partner/api-keys/{apiKeyId}/revoke": {
      post: {
        summary: "Revoke a partner API key",
        security: [{ partnerAdminToken: [] }],
        parameters: [
          {
            name: "apiKeyId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Partner API key revoked",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PartnerApiKeyRevokeResponse",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/PartnerAdminRequired" },
        },
      },
    },
    "/api/v1/partner/payment-decisions": {
      post: {
        summary: "Create a tenant-scoped partner payment decision",
        security: [{ partnerApiKey: [] }],
        responses: {
          "200": {
            description: "Partner payment decision response",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PartnerPaymentDecisionResponse",
                },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/PartnerAuthenticationRequired",
          },
          "403": { $ref: "#/components/responses/PartnerScopeRequired" },
          "429": { $ref: "#/components/responses/PartnerRateLimited" },
        },
      },
    },
    "/api/v1/partner/usage": {
      get: {
        summary: "Get tenant-scoped partner usage",
        security: [{ partnerApiKey: [] }],
        responses: {
          "200": {
            description: "Partner usage summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PartnerUsageResponse" },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/PartnerAuthenticationRequired",
          },
          "403": { $ref: "#/components/responses/PartnerScopeRequired" },
        },
      },
    },
  };
}

export function partnerOpenApiResponses() {
  return {
    PartnerAdminRequired: {
      description: "Partner admin token is missing or invalid",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PartnerErrorResponse" },
        },
      },
    },
    PartnerAuthenticationRequired: {
      description: "Partner API key is missing or invalid",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PartnerErrorResponse" },
        },
      },
    },
    PartnerScopeRequired: {
      description: "Partner API key does not include a required scope",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PartnerErrorResponse" },
        },
      },
    },
    PartnerRateLimited: {
      description: "Partner rate limit exceeded",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PartnerErrorResponse" },
        },
      },
    },
  };
}

export function partnerOpenApiSchemas() {
  return {
    PartnerOrganizationResponse: {
      type: "object",
      required: ["organization"],
      properties: {
        organization: { $ref: "#/components/schemas/PartnerOrganization" },
      },
    },
    PartnerProjectResponse: {
      type: "object",
      required: ["project"],
      properties: {
        project: { $ref: "#/components/schemas/PartnerProject" },
      },
    },
    PartnerApiKeyCreateResponse: {
      type: "object",
      required: ["apiKey", "plaintextKey"],
      properties: {
        apiKey: { $ref: "#/components/schemas/PartnerApiKey" },
        plaintextKey: { type: "string", example: "rw_test_..." },
      },
    },
    PartnerApiKeyRevokeResponse: {
      type: "object",
      required: ["revoked"],
      properties: {
        revoked: { type: "boolean" },
      },
    },
    PartnerPaymentDecisionResponse: {
      allOf: [
        { $ref: "#/components/schemas/PaymentDecisionResponse" },
        {
          type: "object",
          properties: {
            metadata: { $ref: "#/components/schemas/PartnerResponseMetadata" },
          },
        },
      ],
    },
    PartnerResponseMetadata: {
      type: "object",
      required: [
        "requestId",
        "correlationId",
        "organizationId",
        "projectId",
        "environment",
      ],
      properties: {
        requestId: { type: "string" },
        correlationId: { type: "string" },
        organizationId: { type: "string" },
        projectId: { type: "string" },
        environment: {
          type: "string",
          enum: ["live", "test", "sandbox", "development"],
        },
        trust: { type: "object" },
      },
    },
    PartnerOrganization: {
      type: "object",
      required: ["organizationId", "displayName", "status"],
      properties: {
        organizationId: { type: "string" },
        displayName: { type: "string" },
        status: { type: "string", enum: ["active", "suspended", "deleted"] },
        metadata: { type: "object" },
        schemaVersion: { type: "number" },
      },
    },
    PartnerProject: {
      type: "object",
      required: [
        "projectId",
        "organizationId",
        "displayName",
        "environment",
        "status",
      ],
      properties: {
        projectId: { type: "string" },
        organizationId: { type: "string" },
        displayName: { type: "string" },
        environment: {
          type: "string",
          enum: ["live", "test", "sandbox", "development"],
        },
        status: { type: "string", enum: ["active", "suspended", "deleted"] },
      },
    },
    PartnerApiKey: {
      type: "object",
      required: [
        "apiKeyId",
        "organizationId",
        "projectId",
        "environment",
        "keyPreview",
        "scopes",
        "status",
      ],
      properties: {
        apiKeyId: { type: "string" },
        organizationId: { type: "string" },
        projectId: { type: "string" },
        environment: {
          type: "string",
          enum: ["live", "test", "sandbox", "development"],
        },
        keyPrefix: { type: "string", enum: ["rw_live", "rw_test"] },
        keyPreview: { type: "string" },
        scopes: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["active", "revoked", "expired"] },
        expiresAt: { type: ["string", "null"], format: "date-time" },
        lastUsedAt: { type: ["string", "null"], format: "date-time" },
      },
    },
    PartnerUsageResponse: {
      type: "object",
      required: ["usage"],
      properties: {
        usage: {
          type: "object",
          properties: {
            organizationId: { type: "string" },
            projectId: { type: ["string", "null"] },
            requestCount: { type: "number" },
            decisionCount: { type: "number" },
            replayCount: { type: "number" },
            errorCount: { type: "number" },
            rateLimitViolationCount: { type: "number" },
            averageLatencyMs: { type: "number" },
          },
        },
      },
    },
    PartnerErrorResponse: {
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message", "requestId"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            requestId: { type: "string" },
            retryable: { type: "boolean" },
            details: { type: "object" },
          },
        },
      },
    },
  };
}
