import { Router } from "express";
import {
  requireAuthenticatedUser,
  sendAuthError,
  type AuthenticatedRequest,
} from "../../middleware/productionAuth";
import {
  getDecisionAlternatives,
  getDecisionEvidence,
  getDecisionExplanation,
  getTrustRecordByDecisionId,
  replayDecision,
} from "../../services/trustInfrastructureService";

const router = Router();

router.use(requireAuthenticatedUser);

router.get(
  "/decisions/:decisionId",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const record = await getTrustRecordByDecisionId(
      req.params.decisionId,
      accessScope(req),
    );
    if (!record) return trustNotFound(res, req.requestId);
    return res.json({
      decision: {
        decisionId: record.decisionId,
        decisionType: record.decisionType,
        status: record.status,
        recommendation: record.recommendation,
        confidence: record.confidence,
        warnings: record.warnings,
        trustRecordId: record.trustRecordId,
        trustUrl: `/api/v1/decisions/${record.decisionId}/trust`,
      },
    });
  }),
);

router.get(
  "/decisions/:decisionId/explanation",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const explanation = await getDecisionExplanation(
      req.params.decisionId,
      accessScope(req),
    );
    if (!explanation) return trustNotFound(res, req.requestId);
    return res.json({ explanation });
  }),
);

router.get(
  "/decisions/:decisionId/evidence",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const evidence = await getDecisionEvidence(
      req.params.decisionId,
      accessScope(req),
    );
    if (!evidence) return trustNotFound(res, req.requestId);
    return res.json({
      evidence,
      pagination: { hasMore: false, nextCursor: null },
    });
  }),
);

router.get(
  "/decisions/:decisionId/alternatives",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const alternatives = await getDecisionAlternatives(
      req.params.decisionId,
      accessScope(req),
    );
    if (!alternatives) return trustNotFound(res, req.requestId);
    return res.json({ alternatives });
  }),
);

router.get(
  "/decisions/:decisionId/trust",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const record = await getTrustRecordByDecisionId(
      req.params.decisionId,
      accessScope(req),
    );
    if (!record) return trustNotFound(res, req.requestId);
    return res.json({ trust: record });
  }),
);

router.post(
  "/decisions/:decisionId/replay",
  replayRateLimit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const record = await getTrustRecordByDecisionId(
      req.params.decisionId,
      accessScope(req),
    );
    if (!record) return trustNotFound(res, req.requestId);
    const replay = await replayDecision(
      req.params.decisionId,
      accessScope(req),
    );
    return res.json({ replay });
  }),
);

export default router;

function trustNotFound(res: any, requestId?: string) {
  return res.status(404).json({
    error: {
      code: "DECISION_NOT_FOUND",
      message: "Decision trust record was not found.",
      requestId,
    },
  });
}

function accessScope(req: AuthenticatedRequest) {
  return {
    ownerUserId: req.authUser!.userId,
    tenantId: null,
  };
}

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

const replayWindows = new Map<string, { count: number; resetAt: number }>();
const REPLAY_RATE_LIMIT_COUNT = Number(
  process.env.REWARDLY_TRUST_REPLAY_RATE_LIMIT_COUNT || 10,
);
const REPLAY_RATE_LIMIT_WINDOW_MS = Number(
  process.env.REWARDLY_TRUST_REPLAY_RATE_LIMIT_WINDOW_MS || 60_000,
);

function replayRateLimit(
  req: AuthenticatedRequest,
  res: any,
  next: (error?: unknown) => void,
) {
  const key = `${req.authUser?.userId || "anonymous"}:${req.params.decisionId}`;
  const now = Date.now();
  const current = replayWindows.get(key);
  if (!current || current.resetAt <= now) {
    replayWindows.set(key, {
      count: 1,
      resetAt: now + REPLAY_RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }
  current.count += 1;
  if (current.count > REPLAY_RATE_LIMIT_COUNT) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      error: {
        code: "REPLAY_RATE_LIMITED",
        message: "Too many replay attempts. Please try again later.",
        requestId: req.requestId || "req_unknown",
        retryable: true,
      },
    });
  }
  return next();
}

export function decisionTrustOpenApiPaths() {
  const decisionIdParameter = {
    name: "decisionId",
    in: "path",
    required: true,
    schema: { type: "string" },
  };
  const securedResponses = {
    "401": { $ref: "#/components/responses/AuthenticationRequired" },
    "404": { $ref: "#/components/responses/DecisionNotFound" },
  };
  return {
    "/api/v1/decisions/{decisionId}": {
      get: {
        summary: "Get a decision trust summary",
        security: [{ bearerAuth: [] }],
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision trust summary",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DecisionSummaryResponse",
                },
              },
            },
          },
          ...securedResponses,
        },
      },
    },
    "/api/v1/decisions/{decisionId}/explanation": {
      get: {
        summary: "Get canonical decision explanation",
        security: [{ bearerAuth: [] }],
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision explanation",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DecisionExplanationResponse",
                },
              },
            },
          },
          ...securedResponses,
        },
      },
    },
    "/api/v1/decisions/{decisionId}/evidence": {
      get: {
        summary: "Get structured decision evidence",
        security: [{ bearerAuth: [] }],
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision evidence",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DecisionEvidenceResponse",
                },
              },
            },
          },
          ...securedResponses,
        },
      },
    },
    "/api/v1/decisions/{decisionId}/alternatives": {
      get: {
        summary: "Get alternatives considered for a decision",
        security: [{ bearerAuth: [] }],
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision alternatives",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DecisionAlternativesResponse",
                },
              },
            },
          },
          ...securedResponses,
        },
      },
    },
    "/api/v1/decisions/{decisionId}/trust": {
      get: {
        summary: "Get the full canonical Trust Record",
        security: [{ bearerAuth: [] }],
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Decision Trust Record",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DecisionTrustRecordResponse",
                },
              },
            },
          },
          ...securedResponses,
        },
      },
    },
    "/api/v1/decisions/{decisionId}/replay": {
      post: {
        summary: "Replay a decision from its stored snapshot",
        security: [{ bearerAuth: [] }],
        parameters: [decisionIdParameter],
        responses: {
          "200": {
            description: "Replay result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DecisionReplayResponse" },
              },
            },
          },
          ...securedResponses,
          "429": { $ref: "#/components/responses/ReplayRateLimited" },
        },
      },
    },
  };
}

export function decisionTrustOpenApiSchemas() {
  return {
    DecisionSummaryResponse: {
      type: "object",
      properties: {
        decision: { $ref: "#/components/schemas/DecisionSummary" },
      },
    },
    DecisionExplanationResponse: {
      type: "object",
      properties: {
        explanation: { $ref: "#/components/schemas/DecisionExplanation" },
      },
    },
    DecisionEvidenceResponse: {
      type: "object",
      properties: {
        evidence: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionEvidenceItem" },
        },
        pagination: { $ref: "#/components/schemas/CursorPagination" },
      },
    },
    DecisionAlternativesResponse: {
      type: "object",
      properties: {
        alternatives: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionAlternative" },
        },
      },
    },
    DecisionTrustRecordResponse: {
      type: "object",
      properties: {
        trust: { $ref: "#/components/schemas/DecisionTrustRecord" },
      },
    },
    DecisionReplayResponse: {
      type: "object",
      properties: {
        replay: { $ref: "#/components/schemas/DecisionReplayResult" },
      },
    },
    DecisionSummary: {
      type: "object",
      required: [
        "decisionId",
        "decisionType",
        "status",
        "recommendation",
        "confidence",
        "warnings",
        "trustRecordId",
        "trustUrl",
      ],
      properties: {
        decisionId: { type: "string" },
        decisionType: { type: "string", enum: ["payment_decision"] },
        status: {
          type: "string",
          enum: ["complete", "partial", "unavailable"],
        },
        recommendation: { $ref: "#/components/schemas/TrustRecommendation" },
        confidence: { $ref: "#/components/schemas/DecisionConfidence" },
        warnings: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionWarning" },
        },
        trustRecordId: { type: "string" },
        trustUrl: { type: "string" },
      },
    },
    DecisionExplanation: {
      type: "object",
      required: [
        "headline",
        "summary",
        "primaryReason",
        "supportingReasons",
        "tradeoffs",
      ],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        primaryReason: { $ref: "#/components/schemas/ExplanationReason" },
        supportingReasons: {
          type: "array",
          items: { $ref: "#/components/schemas/ExplanationReason" },
        },
        tradeoffs: {
          type: "array",
          items: { $ref: "#/components/schemas/ExplanationTradeoff" },
        },
      },
    },
    ExplanationReason: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
    },
    ExplanationTradeoff: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        impact: { type: "string" },
      },
    },
    DecisionEvidenceItem: {
      type: "object",
      required: ["evidenceId", "type", "source", "statement", "effect"],
      properties: {
        evidenceId: { type: "string" },
        type: { type: "string" },
        source: { type: "string" },
        sourceReference: { type: "string" },
        statement: { type: "string" },
        effect: {
          type: "string",
          enum: ["supports", "limits", "excludes", "informational"],
        },
        subjectId: { type: "string" },
        ruleId: { type: "string" },
        value: {
          oneOf: [{ type: "number" }, { type: "string" }, { type: "boolean" }],
        },
        unit: { type: "string" },
        version: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    DecisionAlternative: {
      type: "object",
      required: [
        "paymentMethodId",
        "displayName",
        "rank",
        "reasonNotSelected",
        "tradeoffs",
      ],
      properties: {
        paymentMethodId: { type: "string" },
        displayName: { type: "string" },
        rank: { type: "number" },
        estimatedValue: { type: ["number", "null"] },
        confidence: { type: "number" },
        reasonNotSelected: {
          $ref: "#/components/schemas/ExplanationReason",
        },
        tradeoffs: { type: "array", items: { type: "string" } },
      },
    },
    TrustRecommendation: {
      type: "object",
      required: ["paymentMethodId", "displayName", "summary"],
      properties: {
        paymentMethodId: { type: ["string", "null"] },
        displayName: { type: ["string", "null"] },
        summary: { type: "string" },
      },
    },
    DecisionWarning: {
      type: "object",
      required: ["code", "severity", "message"],
      properties: {
        code: { type: "string" },
        severity: { type: "string", enum: ["info", "caution", "critical"] },
        message: { type: "string" },
        userAction: { type: "string" },
      },
    },
    DecisionAssumption: {
      type: "object",
      required: ["code", "statement", "source", "confidence"],
      properties: {
        code: { type: "string" },
        statement: { type: "string" },
        source: {
          type: "string",
          enum: ["user", "platform", "inferred", "default"],
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    DecisionConfidence: {
      type: "object",
      required: ["overall", "level", "components", "explanation"],
      properties: {
        overall: { type: "number", minimum: 0, maximum: 1 },
        level: { type: "string", enum: ["high", "medium", "low"] },
        components: {
          type: "object",
          properties: {
            merchantResolution: {
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["unavailable"] },
              ],
            },
            walletCompleteness: {
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["unavailable"] },
              ],
            },
            ruleFreshness: {
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["unavailable"] },
              ],
            },
            benefitEligibility: {
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["unavailable"] },
              ],
            },
            contextCompleteness: {
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["unavailable"] },
              ],
            },
          },
        },
        explanation: { type: "string" },
      },
    },
    DecisionReproducibility: {
      type: "object",
      required: [
        "replayable",
        "replayability",
        "replayLimitations",
        "missingDependencies",
      ],
      properties: {
        replayable: { type: "boolean" },
        replayability: {
          type: "string",
          enum: ["replayable", "partially_replayable", "not_replayable"],
        },
        replayLimitations: { type: "array", items: { type: "string" } },
        inputSnapshotId: { type: "string" },
        policySnapshotId: { type: "string" },
        missingDependencies: { type: "array", items: { type: "string" } },
      },
    },
    DecisionReplayResult: {
      type: "object",
      required: [
        "decisionId",
        "replayId",
        "status",
        "replayability",
        "replayQualityExplanation",
        "differences",
        "versionsUsed",
        "missingDependencies",
        "replayedAt",
      ],
      properties: {
        decisionId: { type: "string" },
        replayId: { type: "string" },
        status: {
          type: "string",
          enum: ["matched", "mismatched", "not_replayable"],
        },
        replayability: {
          type: "string",
          enum: ["replayable", "partially_replayable", "not_replayable"],
        },
        replayQualityExplanation: { type: "string" },
        originalRecommendationId: { type: ["string", "null"] },
        replayedRecommendationId: { type: ["string", "null"] },
        differences: {
          type: "array",
          items: {
            type: "object",
            required: ["field", "original", "replayed"],
            properties: {
              field: { type: "string" },
              original: {},
              replayed: {},
            },
          },
        },
        versionsUsed: { type: "object", additionalProperties: true },
        missingDependencies: { type: "array", items: { type: "string" } },
        replayedAt: { type: "string", format: "date-time" },
      },
    },
    CursorPagination: {
      type: "object",
      required: ["hasMore", "nextCursor"],
      properties: {
        hasMore: { type: "boolean" },
        nextCursor: { type: ["string", "null"] },
      },
    },
    DecisionTrustRecord: {
      type: "object",
      required: [
        "trustRecordId",
        "decisionId",
        "decisionType",
        "status",
        "recommendation",
        "explanation",
        "evidence",
        "alternatives",
        "warnings",
        "assumptions",
        "confidence",
        "versions",
        "reproducibility",
        "provenance",
        "timestamps",
      ],
      properties: {
        trustRecordId: { type: "string" },
        decisionId: { type: "string" },
        decisionType: { type: "string" },
        status: {
          type: "string",
          enum: ["complete", "partial", "unavailable"],
        },
        recommendation: { $ref: "#/components/schemas/TrustRecommendation" },
        explanation: { $ref: "#/components/schemas/DecisionExplanation" },
        evidence: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionEvidenceItem" },
        },
        alternatives: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionAlternative" },
        },
        warnings: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionWarning" },
        },
        assumptions: {
          type: "array",
          items: { $ref: "#/components/schemas/DecisionAssumption" },
        },
        confidence: { $ref: "#/components/schemas/DecisionConfidence" },
        versions: { type: "object" },
        reproducibility: {
          $ref: "#/components/schemas/DecisionReproducibility",
        },
        provenance: { type: "object" },
        timestamps: { type: "object" },
      },
    },
  };
}

export function decisionTrustOpenApiResponses() {
  return {
    AuthenticationRequired: {
      description: "Authentication is required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
          examples: {
            missingAuth: {
              value: {
                error: {
                  code: "AUTHENTICATION_REQUIRED",
                  message: "Sign in is required.",
                  retryable: false,
                },
              },
            },
          },
        },
      },
    },
    DecisionNotFound: {
      description: "Decision not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
          examples: {
            notFound: {
              value: {
                error: {
                  code: "DECISION_NOT_FOUND",
                  message: "Decision trust record was not found.",
                },
              },
            },
          },
        },
      },
    },
    ReplayRateLimited: {
      description: "Replay rate limit exceeded",
      headers: {
        "Retry-After": {
          schema: { type: "string" },
          description: "Seconds until replay may be attempted again.",
        },
      },
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" },
          examples: {
            replayRateLimited: {
              value: {
                error: {
                  code: "REPLAY_RATE_LIMITED",
                  message: "Too many replay attempts. Please try again later.",
                  retryable: true,
                },
              },
            },
          },
        },
      },
    },
  };
}
