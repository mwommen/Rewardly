import type { NextFunction, Request, Response } from "express";
import {
  authenticatePartnerApiKey,
  checkPartnerRateLimit,
  PartnerAuthError,
  recordPartnerUsage,
  type PartnerApiKeyScope,
  type PartnerContext,
} from "../services/partnerPlatformService";
import { recordOperationalEvent } from "../services/privacyLogService";

export type PartnerRequest = Request & {
  partner?: PartnerContext;
  requestId?: string;
  correlationId?: string;
};

export function requirePartnerApiKey(
  scopes: PartnerApiKeyScope[] = [],
  rateLimitBucket:
    "production" | "sandbox" | "replay" | "admin" | "health" = "production",
) {
  return async (req: PartnerRequest, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const requestId = requestIdFor(req);
    const correlationId = String(req.headers["x-correlation-id"] || requestId);
    req.requestId = requestId;
    req.correlationId = correlationId;
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Correlation-Id", correlationId);
    try {
      const partner = await authenticatePartnerApiKey(
        req.headers.authorization,
        scopes,
        requestId,
        correlationId,
      );
      req.partner = partner;
      res.setHeader("X-Rewardly-Organization-Id", partner.organizationId);
      res.setHeader("X-Rewardly-Project-Id", partner.projectId);
      res.setHeader("X-Rewardly-Environment", partner.environment);
      res.setHeader("X-Rewardly-Api-Version", "v1");

      const limit = checkPartnerRateLimit(partner, rateLimitBucket);
      if (!limit.allowed) {
        res.setHeader("Retry-After", String(limit.retryAfterSeconds));
        await recordPartnerUsage({
          context: partner,
          endpoint: req.path,
          method: req.method,
          statusCode: 429,
          latencyMs: Date.now() - startedAt,
          rateLimitViolationCount: 1,
          errorCount: 1,
        });
        return sendPartnerError(
          res,
          new PartnerAuthError(
            429,
            "PARTNER_RATE_LIMITED",
            "Partner rate limit exceeded.",
            true,
          ),
          requestId,
        );
      }

      res.on("finish", () => {
        void recordPartnerUsage({
          context: partner,
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          latencyMs: Date.now() - startedAt,
          decisionCount:
            req.path.includes("payment-decisions") && res.statusCode < 400
              ? 1
              : 0,
          replayCount:
            req.path.includes("/replay") && res.statusCode < 400 ? 1 : 0,
          errorCount: res.statusCode >= 400 ? 1 : 0,
        }).catch(() => undefined);
      });

      return next();
    } catch (error) {
      recordOperationalEvent({
        event: "partner.request_rejected",
        requestId,
        metadata: {
          path: req.path,
          method: req.method,
          error: error instanceof PartnerAuthError ? error.code : "UNKNOWN",
        },
      });
      return sendPartnerError(res, error, requestId);
    }
  };
}

export function sendPartnerError(
  res: Response,
  error: unknown,
  requestId: string,
) {
  if (error instanceof PartnerAuthError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
        retryable: error.retryable,
        details: error.details,
      },
    });
  }
  return res.status(500).json({
    error: {
      code: "PARTNER_PLATFORM_ERROR",
      message: "Rewardly could not complete this partner request.",
      requestId,
      retryable: true,
    },
  });
}

function requestIdFor(req: Request) {
  const explicit = String(req.headers["x-request-id"] || "").trim();
  if (explicit) return explicit.slice(0, 120);
  return `req_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
