import { Router } from "express";
import {
  requireAuthenticatedUser,
  sendAuthError,
  type AuthenticatedRequest,
} from "../../middleware/productionAuth";
import {
  createRequestId,
  deleteRewardlyAccount,
  logoutRewardlySession,
  refreshRewardlySession,
  signInRewardlyUser,
  signUpRewardlyUser,
  type AuthError,
} from "../../services/productionAuthService";

const router = Router();

router.post("/auth/signup", authRateLimit("signup"), async (req, res) => {
  const requestId = requestIdFor(req, res);
  try {
    res.status(201).json(await signUpRewardlyUser(req.body));
  } catch (error) {
    sendAuthError(res, error as AuthError, requestId);
  }
});

router.post("/auth/signin", authRateLimit("signin"), async (req, res) => {
  const requestId = requestIdFor(req, res);
  try {
    res.json(await signInRewardlyUser(req.body));
  } catch (error) {
    sendAuthError(res, error as AuthError, requestId);
  }
});

router.post("/auth/refresh", authRateLimit("refresh"), async (req, res) => {
  const requestId = requestIdFor(req, res);
  try {
    res.json(await refreshRewardlySession(req.body?.refreshToken));
  } catch (error) {
    sendAuthError(res, error as AuthError, requestId);
  }
});

router.post("/auth/logout", authRateLimit("logout"), async (req, res) => {
  await logoutRewardlySession(req.body?.refreshToken, req.headers.authorization);
  res.json({ ok: true });
});

router.get("/auth/session", requireAuthenticatedUser, (req: AuthenticatedRequest, res) => {
  res.json({ ok: true, user: req.authUser });
});

router.delete(
  "/me/account",
  authRateLimit("deleteAccount"),
  requireAuthenticatedUser,
  async (req: AuthenticatedRequest, res) => {
    res.json(await deleteRewardlyAccount(req.authUser!));
  },
);

export default router;

function requestIdFor(req: any, res: any) {
  const requestId = String(req.headers?.["x-request-id"] || "") || createRequestId();
  res.setHeader("X-Request-Id", requestId);
  return requestId;
}

type AuthRateLimitKind = "signup" | "signin" | "refresh" | "logout" | "deleteAccount";

const authRateWindows = new Map<string, { count: number; resetAt: number }>();
const defaultLimits: Record<AuthRateLimitKind, { limit: number; windowMs: number }> = {
  signup: { limit: 5, windowMs: 15 * 60_000 },
  signin: { limit: 10, windowMs: 15 * 60_000 },
  refresh: { limit: 60, windowMs: 15 * 60_000 },
  logout: { limit: 30, windowMs: 15 * 60_000 },
  deleteAccount: { limit: 3, windowMs: 60 * 60_000 },
};

function authRateLimit(kind: AuthRateLimitKind) {
  return (req: any, res: any, next: any) => {
    const requestId = requestIdFor(req, res);
    if (process.env.REWARDLY_DISABLE_AUTH_RATE_LIMITS === "true") return next();
    const config = rateLimitConfig(kind);
    const key = `${kind}:${req.ip || req.socket?.remoteAddress || "unknown"}`;
    const now = Date.now();
    const current = authRateWindows.get(key);
    if (!current || current.resetAt <= now) {
      authRateWindows.set(key, { count: 1, resetAt: now + config.windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > config.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many attempts. Please try again later.",
          requestId,
          retryable: true,
        },
      });
    }
    return next();
  };
}

function rateLimitConfig(kind: AuthRateLimitKind) {
  const prefix = `REWARDLY_AUTH_RATE_LIMIT_${kind.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()}`;
  return {
    limit: positiveInt(process.env[`${prefix}_COUNT`], defaultLimits[kind].limit),
    windowMs: positiveInt(process.env[`${prefix}_WINDOW_MS`], defaultLimits[kind].windowMs),
  };
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
