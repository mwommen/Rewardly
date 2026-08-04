import type { NextFunction, Request, Response } from "express";
import {
  authenticateAccessToken,
  AuthError,
  createRequestId,
  type AuthenticatedUserContext,
} from "../services/productionAuthService";
import { recordOperationalEvent } from "../services/privacyLogService";

export type AuthenticatedRequest = Request & {
  authUser?: AuthenticatedUserContext;
  requestId?: string;
};

export async function requireAuthenticatedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const requestId = String(req.headers["x-request-id"] || "") || createRequestId();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  try {
    req.authUser = await authenticateAccessToken(req.headers.authorization, requestId);
    next();
  } catch (error) {
    recordOperationalEvent({
      event: "auth.request_rejected",
      requestId,
      metadata: {
        path: req.path,
        method: req.method,
        error: error instanceof AuthError ? error.code : "UNKNOWN",
      },
    });
    sendAuthError(res, error, requestId);
  }
}

export function sendAuthError(res: Response, error: unknown, requestId: string) {
  if (error instanceof AuthError) {
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
      code: "SERVICE_UNAVAILABLE",
      message: "Rewardly could not complete this request.",
      requestId,
      retryable: true,
    },
  });
}
